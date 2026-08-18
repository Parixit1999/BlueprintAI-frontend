import {
  Button,
  Modal,
  Popover,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import {
  IconDownload,
  IconFolderOpen,
  IconLayoutGrid,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react'
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  createProject,
  createRegistryRow,
  deleteDrawing,
  downloadRegistryExport,
  listRegistryRows,
  listRegistryTabs,
  updateRegistryRow,
} from '../api'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorState from '../components/ErrorState'
import PageHeader from '../components/PageHeader'
import { useToast } from '../components/Toast'

ModuleRegistry.registerModules([AllCommunityModule])

// Shown INSIDE the grid frame while a sheet loads: the table (with its
// familiar columns) appears instantly and only the rows are pending, so the
// page never swaps layouts mid-load.
function BookLoadingOverlay() {
  return (
    <div className="registry-loading" role="status">
      <div className="brand-mark loading-pulse">B</div>
      <span>Opening the book…</span>
    </div>
  )
}

// Dense, spreadsheet-first grid on the app's design tokens: minimal padding
// for maximum data visibility, visible focus for keyboard use, row hover
// highlight, no decorative motion. Column borders on cells AND headers give
// the ledger-ruled look the Number Book is modeled on - a spreadsheet reads
// as a spreadsheet.
const gridTheme = themeQuartz.withParams({
  accentColor: '#2a78d6',
  fontSize: 12.5,
  spacing: 4.5,
  headerFontWeight: 600,
  headerBackgroundColor: '#f4f7fb',
  oddRowBackgroundColor: '#fafbfc',
  cellHorizontalPaddingScale: 0.8,
  wrapperBorderRadius: 8,
  borderColor: '#e4e9ef', // --hairline
  columnBorder: true,
  headerColumnBorder: true,
})

// The book's editable columns; everything else on the row is derived.
const EDITABLE = new Set([
  'dwg_number', 'sheet_count', 'description', 'contract_number',
  'drawing_date', 'set_number',
])

/**
 * Long-cell tooltip: the full value as wrapped, readable prose instead of
 * the browser's single-line strip. Used by Description, where AI summaries
 * are paragraphs.
 */
function CellTooltip({ value }) {
  if (!value) return null
  return <div className="grid-tooltip">{value}</div>
}

/**
 * Sheet navigation built for a real book: dozens of sheets don't fit in a
 * tab strip, so the picker button opens a searchable list of every sheet
 * (Excel's right-click sheet list, made searchable), Main Book stays pinned,
 * and the strip scrolls for everything in between.
 */
function SheetBar({ tabs, activeId, onSelect, onNewSheet }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const stripRef = useRef(null)

  // keep the active tab visible as the user moves between sheets
  useEffect(() => {
    const el = stripRef.current?.querySelector('[aria-selected="true"]')
    el?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [activeId])

  const q = pickerQuery.trim().toLowerCase()
  const filtered = q ? tabs.filter((t) => t.name.toLowerCase().includes(q)) : tabs
  const main = tabs.find((t) => t.id === null)
  const sheets = tabs.filter((t) => t.id !== null)

  function Tab({ tab }) {
    return (
      <button
        role="tab"
        aria-selected={tab.id === activeId}
        className={tab.id === activeId ? 'registry-tab active' : 'registry-tab'}
        onClick={() => onSelect(tab.id)}
        title={`${tab.name} - ${tab.count.toLocaleString()} rows`}
      >
        {tab.name}
        <span className="registry-tab-count">{tab.count.toLocaleString()}</span>
      </button>
    )
  }

  return (
    <div className="registry-sheetbar">
      <Popover
        opened={pickerOpen}
        onChange={setPickerOpen}
        position="top-start"
        width={340}
        shadow="md"
        transitionProps={{ duration: 0 }}
      >
        <Popover.Target>
          <Tooltip label="All sheets" withArrow>
            <button
              className="registry-tab registry-sheet-picker"
              aria-label={`All sheets (${tabs.length})`}
              onClick={() => setPickerOpen((o) => !o)}
            >
              <IconLayoutGrid size={14} />
              {tabs.length.toLocaleString()}
            </button>
          </Tooltip>
        </Popover.Target>
        <Popover.Dropdown p="xs">
          <TextInput
            placeholder="Find a sheet…"
            leftSection={<IconSearch size={14} />}
            value={pickerQuery}
            onChange={(e) => setPickerQuery(e.currentTarget.value)}
            size="xs"
            mb={6}
            autoFocus
          />
          <ScrollArea.Autosize mah={320} type="auto">
            <Stack gap={2}>
              {filtered.map((t) => (
                <button
                  key={t.id ?? 'main'}
                  className={
                    t.id === activeId
                      ? 'registry-sheet-item active'
                      : 'registry-sheet-item'
                  }
                  onClick={() => {
                    onSelect(t.id)
                    setPickerOpen(false)
                    setPickerQuery('')
                  }}
                >
                  <span className="registry-sheet-item-name">{t.name}</span>
                  <span className="registry-tab-count">{t.count.toLocaleString()}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <Text size="xs" c="dimmed" ta="center" py={8}>
                  No sheet matches “{pickerQuery}”.
                </Text>
              )}
            </Stack>
          </ScrollArea.Autosize>
        </Popover.Dropdown>
      </Popover>

      {main && <Tab tab={main} />}

      <div className="registry-tabs" role="tablist" aria-label="Sheets" ref={stripRef}>
        {sheets.map((t) => (
          <Tab key={t.id} tab={t} />
        ))}
      </div>

      <Tooltip label="New sheet" withArrow>
        <button className="registry-tab registry-new-sheet" aria-label="New sheet" onClick={onNewSheet}>
          <IconPlus size={14} />
        </button>
      </Tooltip>
    </div>
  )
}

export default function Registry() {
  const [tabs, setTabs] = useState(null)
  const [rows, setRows] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [quickFilter, setQuickFilter] = useState('')
  const [selectedCount, setSelectedCount] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [newSheet, setNewSheet] = useState(false)
  const [newSheetName, setNewSheetName] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDeleteRow, setConfirmDeleteRow] = useState(null)
  const gridRef = useRef(null)
  const reverting = useRef(false)
  // pending "open the drawing" from a single click on DWG #, held for one
  // double-click window so a double-click edits the row instead of navigating
  const openTimer = useRef(null)
  // row values as they were when a row edit started, for diffing on commit
  const editSnapshot = useRef(null)
  const toast = useToast()
  const navigate = useNavigate()

  const cancelPendingOpen = useCallback(() => {
    if (openTimer.current) {
      clearTimeout(openTimer.current)
      openTimer.current = null
    }
  }, [])

  useEffect(() => cancelPendingOpen, [cancelPendingOpen])

  // active sheet lives in the URL so it survives navigation and refresh
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('sheet') // null = Main Book
  const setActiveTab = useCallback(
    (id) => {
      const next = new URLSearchParams(searchParams)
      if (id) next.set('sheet', id)
      else next.delete('sheet')
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  const loadTabs = useCallback(async () => {
    const data = await listRegistryTabs()
    setTabs(data.tabs)
    // Role-scoped books have no Main Book tab, and a deep link can point at
    // a sheet outside the role. Snap to the first tab the server returned
    // (the server also refuses disallowed rows - this is just the UX half).
    // Functional updater: reads the CURRENT params without making loadTabs
    // depend on them, so tab switches don't refetch the tab list.
    const ids = data.tabs.map((t) => t.id)
    setSearchParams(
      (prev) => {
        const current = prev.get('sheet')
        if (ids.includes(current)) return prev
        const next = new URLSearchParams(prev)
        if (ids[0]) next.set('sheet', ids[0])
        else next.delete('sheet')
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

  const loadRows = useCallback(async (projectId) => {
    setRows(null)
    setLoadError(null)
    try {
      const data = await listRegistryRows(projectId)
      setRows(data.rows)
    } catch (err) {
      setLoadError(err.message)
    }
  }, [])

  useEffect(() => {
    loadTabs().catch((err) => setLoadError(err.message))
  }, [loadTabs])

  useEffect(() => {
    loadRows(activeTab)
  }, [activeTab, loadRows])

  const columnDefs = useMemo(() => {
    const cols = [
      {
        // Excel-style row numbers, doubling as the row's "open" handle:
        // one click on the number opens the drawing page (files, versions,
        // viewer). Not editable, so the click needs no dblclick guard.
        headerName: '',
        valueGetter: (p) => (p.node.rowIndex ?? 0) + 1,
        width: 52,
        pinned: 'left',
        editable: false,
        suppressMovable: true,
        sortable: false,
        filter: false,
        cellClass: 'registry-rownum',
        tooltipValueGetter: () => 'Open this drawing',
        onCellClicked: (p) => navigate(`/drawings/${p.data.drawing_id}`),
      },
      {
        // Row actions sit next to the index so every row exposes the same two
        // verbs in the same place: edit opens the WHOLE row for editing, the
        // bin soft-deletes it (recoverable from the Deleted page).
        headerName: '',
        colId: 'actions',
        width: 74,
        pinned: 'left',
        editable: false,
        sortable: false,
        filter: false,
        suppressMovable: true,
        resizable: false,
        cellClass: 'registry-actions-cell',
        cellRenderer: (p) => (
          <span className="registry-actions">
            <button
              type="button"
              className="registry-action"
              title="Edit this row"
              aria-label={`Edit row ${p.data?.dwg_number ?? ''}`}
              onClick={(e) => {
                e.stopPropagation()
                cancelPendingOpen()
                p.api.startEditingCell({
                  rowIndex: p.node.rowIndex,
                  colKey: 'dwg_number',
                })
              }}
            >
              <IconPencil size={15} stroke={1.8} />
            </button>
            <button
              type="button"
              className="registry-action registry-action-danger"
              title="Delete this row"
              aria-label={`Delete row ${p.data?.dwg_number ?? ''}`}
              onClick={(e) => {
                e.stopPropagation()
                cancelPendingOpen()
                setConfirmDeleteRow(p.data)
              }}
            >
              <IconTrash size={15} stroke={1.8} />
            </button>
          </span>
        ),
      },
      {
        field: 'dwg_number',
        headerName: 'DWG #',
        width: 150,
        pinned: 'left',
        cellClass: 'registry-open-cell',
        tooltipValueGetter: () => 'Click to open · double-click to edit the row',
        // Single click opens the drawing, double-click still edits. Both
        // gestures start with a click, so the open waits one dblclick window
        // and is cancelled the moment a second click (or row edit) arrives.
        onCellClicked: (p) => {
          if (p.api.getEditingCells().length) return
          cancelPendingOpen()
          openTimer.current = setTimeout(
            () => navigate(`/drawings/${p.data.drawing_id}`),
            240
          )
        },
      },
      {
        field: 'sheet_count',
        headerName: '# of Sheets',
        width: 110,
        type: 'numericColumn',
        // Excel lets you type anything; keep numbers numbers, blank clears
        valueParser: (p) => {
          if (p.newValue === '' || p.newValue == null) return null
          const n = parseInt(p.newValue, 10)
          return Number.isNaN(n) ? p.oldValue : n
        },
      },
      {
        // the scan this row came from - derived from the attached file, so
        // it is read-only and follows the file if it is reassigned
        field: 'filename',
        headerName: 'Name',
        width: 220,
        editable: false,
        cellClass: 'registry-muted',
        tooltipField: 'filename',
        tooltipComponent: CellTooltip,
      },
      {
        field: 'description',
        headerName: 'Description',
        flex: 1,
        minWidth: 320,
        // AI summaries run long. The cell stays one line so the book keeps
        // its density; hovering opens the full text as a wrapped panel you
        // can read - and move onto, so it can be selected and copied.
        tooltipField: 'description',
        tooltipComponent: CellTooltip,
      },
      { field: 'contract_number', headerName: 'Contract #', width: 180 },
      { field: 'drawing_date', headerName: 'Date', width: 110 },
      { field: 'set_number', headerName: 'Set #', width: 90 },
    ]
    if (activeTab === null) {
      cols.push({
        field: 'project_name',
        headerName: 'Project',
        width: 220,
        editable: false,
        cellClass: 'registry-muted',
      })
    }
    // The old PDF column is gone: opening a drawing's scans is what the row
    // number and DWG # now do, so the book keeps its width for book data.
    return cols
  }, [activeTab, navigate, cancelPendingOpen])

  const isBlank = (v) => v === null || v === undefined || v === ''

  const defaultColDef = useMemo(
    () => ({
      editable: (p) => EDITABLE.has(p.colDef.field),
      resizable: true,
      sortable: true,
      filter: true,
      // A ruled book marks an empty field with a dash rather than leaving it
      // blank, so a missing value reads as "nothing recorded" instead of a
      // rendering gap. Editing still sees the real (empty) value.
      valueFormatter: (p) => (isBlank(p.value) ? '-' : String(p.value)),
      cellClassRules: { 'registry-empty': (p) => isBlank(p.value) },
    }),
    []
  )

  // Row editing: opening one cell opens the whole row, so persistence is
  // per ROW - snapshot the values when editing starts, then send one PATCH
  // with whatever actually changed. On failure the snapshot goes back.
  const onRowEditingStarted = useCallback(
    (e) => {
      cancelPendingOpen()
      editSnapshot.current = { ...e.data }
    },
    [cancelPendingOpen]
  )

  const onRowValueChanged = useCallback(
    async (e) => {
      if (reverting.current) return
      const before = editSnapshot.current
      editSnapshot.current = null
      if (!before) return
      const norm = (v) => (v === '' || v === undefined ? null : v)
      const changed = {}
      for (const field of EDITABLE) {
        if (norm(e.data[field]) !== norm(before[field])) {
          changed[field] = norm(e.data[field])
        }
      }
      if (Object.keys(changed).length === 0) return
      try {
        await updateRegistryRow(e.data.drawing_id, changed)
      } catch (err) {
        toast.error(err.message)
        reverting.current = true
        for (const field of Object.keys(changed)) {
          e.node.setDataValue(field, before[field])
        }
        reverting.current = false
      }
    },
    [toast]
  )

  async function addRow() {
    setBusy(true)
    try {
      const created = await createRegistryRow(activeTab ? { project_id: activeTab } : {})
      const row = { ...created, set_number: null, file_count: 0, project_name: null }
      const res = gridRef.current.api.applyTransaction({ add: [row] })
      const node = res.add[0]
      gridRef.current.api.ensureIndexVisible(node.rowIndex, 'bottom')
      gridRef.current.api.startEditingCell({ rowIndex: node.rowIndex, colKey: 'dwg_number' })
      loadTabs() // row counts changed
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function createSheet(e) {
    e.preventDefault()
    const name = newSheetName.trim()
    if (!name) return
    setBusy(true)
    try {
      const p = await createProject({ name })
      toast.success(`Sheet “${name}” created.`)
      setNewSheet(false)
      setNewSheetName('')
      await loadTabs()
      setActiveTab(p.project_id)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Bin icon on a single row. Soft delete, so the row moves to the Deleted
  // page rather than disappearing - the toast says so and offers the way back.
  async function deleteRow(row) {
    setBusy(true)
    try {
      await deleteDrawing(row.drawing_id)
      gridRef.current.api.applyTransaction({ remove: [row] })
      toast.success(`${row.dwg_number || 'Row'} moved to Deleted.`)
      loadTabs()
    } catch (err) {
      toast.error(err.message)
      loadRows(activeTab)
    } finally {
      setBusy(false)
      setConfirmDeleteRow(null)
    }
  }

  async function deleteSelected() {
    const nodes = gridRef.current.api.getSelectedNodes()
    setBusy(true)
    try {
      for (const node of nodes) {
        await deleteDrawing(node.data.drawing_id)
      }
      gridRef.current.api.applyTransaction({ remove: nodes.map((n) => n.data) })
      toast.success(`${nodes.length} row${nodes.length === 1 ? '' : 's'} deleted.`)
      setSelectedCount(0)
      loadTabs()
    } catch (err) {
      toast.error(err.message)
      loadRows(activeTab) // partial delete: resync with the server
    } finally {
      setBusy(false)
      setConfirmDelete(false)
    }
  }

  async function exportBook() {
    try {
      await downloadRegistryExport(activeTab)
      toast.success('Exported to Excel.')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const activeName = tabs?.find((t) => t.id === activeTab)?.name ?? 'Main Book'

  return (
    <div className="registry-page">
      <PageHeader
        title="Drawings Number Book"
        description="The registry, kept the way the book has always worked - every cell you edit is saved instantly and searchable in chat."
        onRefresh={() => Promise.all([loadTabs(), loadRows(activeTab)])}
        actions={
          <>
            {selectedCount > 0 && (
              <Button
                variant="light"
                color="red"
                leftSection={<IconTrash size={16} />}
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
              >
                Delete {selectedCount}
              </Button>
            )}
            {activeTab && (
              <Tooltip label="Files and settings for this sheet's project" withArrow>
                <Button
                  variant="default"
                  leftSection={<IconFolderOpen size={16} />}
                  onClick={() => navigate(`/projects/${activeTab}`)}
                >
                  Sheet files
                </Button>
              </Tooltip>
            )}
            <Tooltip label="Rows deleted from the book" withArrow>
              <Button
                variant="default"
                leftSection={<IconTrash size={16} />}
                onClick={() => navigate('/registry/deleted')}
              >
                Deleted
              </Button>
            </Tooltip>
            <Button variant="default" leftSection={<IconDownload size={16} />} onClick={exportBook}>
              Export {activeTab ? 'sheet' : 'book'}
            </Button>
            <Button leftSection={<IconPlus size={16} />} onClick={addRow} disabled={busy}>
              Add row
            </Button>
          </>
        }
        mb="md"
      />

      <TextInput
        placeholder={`Search ${activeName}…`}
        leftSection={<IconSearch size={15} />}
        value={quickFilter}
        onChange={(e) => setQuickFilter(e.currentTarget.value)}
        size="sm"
        mb={10}
        maw={360}
      />

      {loadError ? (
        <ErrorState message={loadError} onRetry={() => loadRows(activeTab)} />
      ) : (
        <div className="registry-grid">
          <AgGridReact
            ref={gridRef}
            theme={gridTheme}
            rowData={rows ?? []}
            loading={rows === null}
            loadingOverlayComponent={BookLoadingOverlay}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            getRowId={(p) => p.data.drawing_id}
            quickFilterText={quickFilter}
            // Editing a cell opens the WHOLE row, so the pen icon and a
            // double-click land in the same place: every field of that row
            // editable at once, committed together.
            // long summaries need a beat before they appear, and the tooltip
            // stays put once you move onto it so the text can be selected
            tooltipShowDelay={300}
            tooltipInteraction
            editType="fullRow"
            onRowEditingStarted={onRowEditingStarted}
            onRowValueChanged={onRowValueChanged}
            onCellDoubleClicked={cancelPendingOpen}
            rowSelection={{ mode: 'multiRow', checkboxes: true, headerCheckbox: true }}
            // pinned left so the checkbox is the FIRST column - unpinned, it
            // sorted after the pinned index/DWG columns and landed third
            selectionColumnDef={{
              pinned: 'left',
              width: 44,
              maxWidth: 44,
              resizable: false,
              suppressMovable: true,
            }}
            onSelectionChanged={(e) => setSelectedCount(e.api.getSelectedNodes().length)}
            // Excel muscle memory: Enter commits and moves down
            enterNavigatesVertically
            enterNavigatesVerticallyAfterEdit
            stopEditingWhenCellsLoseFocus
            animateRows={false}
          />
        </div>
      )}

      {tabs && (
        <SheetBar
          tabs={tabs}
          activeId={activeTab}
          onSelect={setActiveTab}
          onNewSheet={() => setNewSheet(true)}
        />
      )}

      {confirmDeleteRow && (
        <ConfirmDialog
          title={`Delete ${confirmDeleteRow.dwg_number || 'this row'}?`}
          message="The row moves to the Deleted page and stops appearing in search and chat. You can restore it from there at any time."
          confirmLabel="Delete row"
          danger
          busy={busy}
          onConfirm={() => deleteRow(confirmDeleteRow)}
          onCancel={() => setConfirmDeleteRow(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${selectedCount} row${selectedCount === 1 ? '' : 's'}?`}
          message="The rows move to the Deleted page and stop appearing in search and chat. Attached scan files stay in Documents, and restoring a row brings them back with it."
          confirmLabel="Delete"
          danger
          busy={busy}
          onConfirm={deleteSelected}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      <Modal
        opened={newSheet}
        onClose={() => setNewSheet(false)}
        title="New sheet"
        centered
        radius="md"
        transitionProps={{ duration: 0 }}
      >
        <form onSubmit={createSheet}>
          <Stack gap="sm">
            <TextInput
              label="Sheet name"
              description="Creates a project - its drawings appear under this sheet tab."
              value={newSheetName}
              onChange={(e) => setNewSheetName(e.currentTarget.value)}
              placeholder="e.g. DPS 1 Pumping Station"
              required
              autoFocus
            />
            <Button type="submit" loading={busy}>
              Create sheet
            </Button>
          </Stack>
        </form>
      </Modal>
    </div>
  )
}
