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
// highlight, no decorative motion.
const gridTheme = themeQuartz.withParams({
  accentColor: '#2a78d6',
  fontSize: 12.5,
  spacing: 4.5,
  headerFontWeight: 600,
  headerBackgroundColor: '#f4f7fb',
  oddRowBackgroundColor: '#fafbfc',
  cellHorizontalPaddingScale: 0.8,
  wrapperBorderRadius: 8,
})

// The book's editable columns; everything else on the row is derived.
const EDITABLE = new Set([
  'dwg_number', 'sheet_count', 'description', 'contract_number',
  'drawing_date', 'set_number',
])

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
  const gridRef = useRef(null)
  const reverting = useRef(false)
  const toast = useToast()
  const navigate = useNavigate()

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
  }, [])

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
        // viewer) - no need to aim for the PDF column on the far right.
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
      { field: 'dwg_number', headerName: 'DWG #', width: 150, pinned: 'left' },
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
      { field: 'description', headerName: 'Description', flex: 1, minWidth: 320 },
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
    cols.push({
      // the book's PDF column: how many scans are attached (0 when none);
      // click opens the drawing with its files
      field: 'file_count',
      headerName: 'PDF',
      width: 80,
      editable: false,
      type: 'numericColumn',
      cellClass: 'registry-scans',
      valueFormatter: (p) => String(p.value ?? 0),
      onCellClicked: (p) => navigate(`/drawings/${p.data.drawing_id}`),
    })
    return cols
  }, [activeTab, navigate])

  const defaultColDef = useMemo(
    () => ({
      editable: (p) => EDITABLE.has(p.colDef.field),
      resizable: true,
      sortable: true,
      filter: true,
    }),
    []
  )

  // Persist every committed cell edit; on failure, put the old value back.
  const onCellValueChanged = useCallback(
    async (e) => {
      if (reverting.current) return
      const field = e.colDef.field
      if (!EDITABLE.has(field)) return
      const value = e.newValue === '' || e.newValue === undefined ? null : e.newValue
      try {
        await updateRegistryRow(e.data.drawing_id, { [field]: value })
      } catch (err) {
        toast.error(err.message)
        reverting.current = true
        e.node.setDataValue(field, e.oldValue)
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
            onCellValueChanged={onCellValueChanged}
            rowSelection={{ mode: 'multiRow', checkboxes: true, headerCheckbox: true }}
            onSelectionChanged={(e) => setSelectedCount(e.api.getSelectedNodes().length)}
            // Excel muscle memory: Enter commits and moves down, undo works
            enterNavigatesVertically
            enterNavigatesVerticallyAfterEdit
            undoRedoCellEditing
            undoRedoCellEditingLimit={50}
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

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${selectedCount} row${selectedCount === 1 ? '' : 's'}?`}
          message="This removes the drawings from the registry. Attached scan files stay in Documents and can be reassigned."
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
