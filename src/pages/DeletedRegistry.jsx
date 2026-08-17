import { Button } from '@mantine/core'
import { IconArrowBackUp, IconArrowLeft } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listDeletedRegistryRows, restoreRegistryRow } from '../api'
import ErrorState from '../components/ErrorState'
import Loading from '../components/Loading'
import PageHeader from '../components/PageHeader'
import { useToast } from '../components/Toast'

/**
 * The book's recycle bin. Deleting a registry row is a soft delete, so this
 * page is where those rows wait: every one can go back to its sheet exactly
 * as it was, with its attached scans still linked.
 */
export default function DeletedRegistry() {
  const [rows, setRows] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [restoringId, setRestoringId] = useState(null)
  const toast = useToast()
  const navigate = useNavigate()

  function refresh() {
    return listDeletedRegistryRows()
      .then((d) => {
        setRows(d.rows)
        setLoadError(null)
      })
      .catch((e) => (rows ? toast.error(e.message) : setLoadError(e.message)))
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function restore(row) {
    setRestoringId(row.drawing_id)
    try {
      await restoreRegistryRow(row.drawing_id)
      setRows((prev) => prev.filter((r) => r.drawing_id !== row.drawing_id))
      toast.success(`${row.dwg_number || 'Row'} restored to the book.`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Deleted rows"
        description="Rows removed from the Drawings Number Book. Restoring one puts it back on its sheet with its scans still attached."
        onRefresh={refresh}
        actions={
          <Button
            variant="default"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/registry')}
          >
            Back to the book
          </Button>
        }
      />

      {rows === null && loadError ? (
        <ErrorState message={loadError} onRetry={refresh} />
      ) : rows === null ? (
        <Loading label="Loading deleted rows…" />
      ) : (
        <div className="panel table-panel">
          <table className="table-fixed">
            <colgroup>
              <col style={{ width: 150 }} />
              <col />
              <col style={{ width: 200 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 130 }} />
            </colgroup>
            <thead>
              <tr>
                <th>DWG #</th>
                <th>Description</th>
                <th>Project</th>
                <th>Deleted</th>
                <th className="th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.drawing_id} className="no-hover">
                  <td className="cell-name">
                    <div className="name-primary">{r.dwg_number || '-'}</div>
                  </td>
                  <td title={r.description ?? ''}>{r.description || '-'}</td>
                  <td className="muted">{r.project_name || '-'}</td>
                  <td className="cell-date" title={new Date(r.deleted_at).toLocaleString()}>
                    <div>{new Date(r.deleted_at).toLocaleDateString('en-CA')}</div>
                    <div className="cell-time">
                      {new Date(r.deleted_at).toLocaleTimeString('en-GB')}
                    </div>
                  </td>
                  <td className="cell-action">
                    <Button
                      variant="light"
                      size="compact-xs"
                      leftSection={<IconArrowBackUp size={14} />}
                      loading={restoringId === r.drawing_id}
                      onClick={() => restore(r)}
                    >
                      Restore
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr className="no-hover">
                  <td colSpan={5} className="empty-note center">
                    Nothing deleted. Rows you remove from the book will wait here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
