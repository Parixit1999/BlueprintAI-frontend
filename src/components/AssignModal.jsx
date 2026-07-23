import {
  Badge,
  Button,
  Divider,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { IconFile, IconFolder, IconFolderPlus, IconSparkles } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { assignFile, createProject, getFileSuggestions, listProjects } from '../api'
import Loading from './Loading'
import { useToast } from './Toast'

/**
 * Assign an uploaded file to the registry: either attach it to an existing
 * drawing (as a sheet/version file) or create a new drawing under a project.
 * Suggestions come from the smart matcher (filename signals: DWG numbers,
 * pj#### project numbers, name fragments, initials) - the user confirms.
 */
export default function AssignModal({ file, onClose, onAssigned }) {
  const [suggestions, setSuggestions] = useState(null)
  const [projects, setProjects] = useState([])
  const [manualProject, setManualProject] = useState(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newNumber, setNewNumber] = useState('')
  // the registry drawing number a new drawing will be created with -
  // prefilled from the file name so the user SEES the label before it exists
  const [dwgNumber, setDwgNumber] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  useEffect(() => {
    Promise.all([getFileSuggestions(file.file_id), listProjects()])
      .then(([s, p]) => {
        setSuggestions(s)
        setProjects(p)
        setDwgNumber(s.parsed?.dwg_candidates?.[0]?.norm ?? '')
      })
      .catch((e) => toast.error(e.message))
  }, [file.file_id])

  // payload fragment for every create-a-drawing path
  const newDrawing = (projectId) => ({
    project_id: projectId,
    ...(dwgNumber.trim() ? { dwg_number: dwgNumber.trim() } : {}),
  })
  const drawingLabel = dwgNumber.trim() || 'a new drawing'

  async function doAssign(payload, successMessage) {
    setBusy(true)
    try {
      await assignFile(file.file_id, payload)
      toast.success(successMessage)
      onAssigned()
    } catch (e) {
      toast.error(e.message)
      setBusy(false)
    }
  }

  const pct = (score) => `${Math.round(score * 100)}%`

  return (
    <Modal opened onClose={onClose} title={`Assign ${file.filename}`} centered size="lg">
      {suggestions === null ? (
        <Loading label="Analyzing file name…" py="lg" size="sm" />
      ) : (
        <Stack gap="md">
          {suggestions.drawing_suggestions.length > 0 && (
            <div>
              <Group gap={6} mb={6}>
                <IconSparkles size={16} color="var(--mantine-color-brand-6)" />
                <Text size="sm" fw={600}>
                  Matching drawings
                </Text>
              </Group>
              <Stack gap={6}>
                {suggestions.drawing_suggestions.map((s) => (
                  <Group
                    key={s.drawing_id}
                    justify="space-between"
                    wrap="nowrap"
                    px="sm"
                    py={8}
                    style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 8 }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <Group gap="xs" wrap="nowrap">
                        <IconFile size={15} />
                        <Text size="sm" fw={500} truncate>
                          {s.dwg_number}
                          {s.project_name ? ` · ${s.project_name}` : ''}
                        </Text>
                        <Badge variant="light" size="sm">
                          {pct(s.score)}
                        </Badge>
                      </Group>
                      <Text size="xs" c="dimmed" truncate>
                        {s.description ?? ''} — {s.reason}
                      </Text>
                    </div>
                    <Button
                      size="compact-sm"
                      loading={busy}
                      onClick={() =>
                        doAssign(
                          { drawing_id: s.drawing_id },
                          `Attached to drawing ${s.dwg_number}.`,
                        )
                      }
                    >
                      Attach
                    </Button>
                  </Group>
                ))}
              </Stack>
            </div>
          )}

          {suggestions.project_suggestions.length > 0 && (
            <div>
              <Group gap={6} mb={6}>
                <IconSparkles size={16} color="var(--mantine-color-brand-6)" />
                <Text size="sm" fw={600}>
                  Matching projects
                </Text>
              </Group>
              <Stack gap={6}>
                {suggestions.project_suggestions.map((s) => (
                  <Group
                    key={s.project_id}
                    justify="space-between"
                    wrap="nowrap"
                    px="sm"
                    py={8}
                    style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 8 }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <Group gap="xs" wrap="nowrap">
                        <IconFolder size={15} />
                        <Text size="sm" fw={500} truncate>
                          {s.name}
                          {s.number ? ` (#${s.number})` : ''}
                        </Text>
                        <Badge variant="light" size="sm">
                          {pct(s.score)}
                        </Badge>
                      </Group>
                      <Text size="xs" c="dimmed" truncate>
                        {s.reason}
                      </Text>
                    </div>
                    <Button
                      size="compact-sm"
                      variant="light"
                      loading={busy}
                      onClick={() =>
                        doAssign(
                          { new_drawing: newDrawing(s.project_id) },
                          `Added to ${s.name} as drawing ${drawingLabel}.`,
                        )
                      }
                    >
                      Add here
                    </Button>
                  </Group>
                ))}
              </Stack>
            </div>
          )}

          {suggestions.drawing_suggestions.length === 0 &&
            suggestions.project_suggestions.length === 0 && (
              <Text size="sm" c="dimmed">
                No automatic match found in the file name. Pick a project below — a new
                drawing will be created in it for this file.
              </Text>
            )}

          <TextInput
            label="Drawing number"
            description="Assigning to a project files this document under a drawing in the registry. This is the number that drawing gets — detected from the file name; edit it if it's wrong."
            placeholder="e.g. 11778-W-59 (left blank: taken from the file name)"
            value={dwgNumber}
            onChange={(e) => setDwgNumber(e.currentTarget.value)}
          />

          <Divider label="Or assign manually" labelPosition="center" />
          {!creating && (
            <Group wrap="nowrap" align="flex-end">
              <Select
                label="Project"
                placeholder={projects.length ? 'Choose a project…' : 'No projects yet'}
                data={projects.map((p) => ({
                  value: p.project_id,
                  label: p.number ? `${p.name} (#${p.number})` : p.name,
                }))}
                value={manualProject}
                onChange={setManualProject}
                searchable
                style={{ flex: 1 }}
              />
              <Button
                disabled={!manualProject}
                loading={busy}
                onClick={() =>
                  doAssign(
                    { new_drawing: newDrawing(manualProject) },
                    `File assigned as drawing ${drawingLabel}.`,
                  )
                }
              >
                Assign
              </Button>
            </Group>
          )}
          {creating ? (
            <Stack gap="xs">
              <Group wrap="nowrap" grow>
                <TextInput
                  label="New project name"
                  placeholder="e.g. Riverside Pump Station Rehabilitation"
                  value={newName}
                  onChange={(e) => setNewName(e.currentTarget.value)}
                  autoFocus
                />
                <TextInput
                  label="Project number (optional)"
                  placeholder="e.g. 1234"
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.currentTarget.value)}
                />
              </Group>
              <Group justify="flex-end" gap="xs">
                <Button variant="default" onClick={() => setCreating(false)}>
                  Back
                </Button>
                <Button
                  disabled={!newName.trim()}
                  loading={busy}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      const p = await createProject({
                        name: newName.trim(),
                        number: newNumber.trim() || null,
                      })
                      await doAssign(
                        { new_drawing: newDrawing(p.project_id) },
                        `Created "${p.name}" and filed this document as drawing ${drawingLabel}.`,
                      )
                    } catch (e) {
                      toast.error(e.message)
                      setBusy(false)
                    }
                  }}
                >
                  Create & assign
                </Button>
              </Group>
            </Stack>
          ) : (
            <Button
              variant="subtle"
              size="compact-sm"
              leftSection={<IconFolderPlus size={15} />}
              style={{ alignSelf: 'flex-start' }}
              onClick={() => setCreating(true)}
            >
              Create a new project for this file
            </Button>
          )}
        </Stack>
      )}
    </Modal>
  )
}
