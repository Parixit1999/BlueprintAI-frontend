import { Button, Group, Text, TextInput } from '@mantine/core'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { useEffect, useState } from 'react'

/**
 * The one pagination control for every list and table.
 *
 * Classic prev/next with a typeable page number - "Prev · Page [3] of 738 ·
 * Next" - so it reads the same at 2 pages or 2,000 and any page is one
 * keystroke away. Type a page and press Enter (or click away) to jump;
 * out-of-range numbers clamp to the nearest valid page. Renders nothing for
 * a single page. The parent owns `page` (URL param or state) and
 * slices/fetches accordingly.
 */
export default function TablePagination({ page, pageSize, totalItems, onChange }) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize))
  const current = Math.min(Math.max(1, page), pageCount)
  const [draft, setDraft] = useState(String(current))

  // external page changes (prev/next, filter reset) refresh the input
  useEffect(() => setDraft(String(current)), [current])

  if (pageCount <= 1) return null

  function commitDraft() {
    const n = parseInt(draft, 10)
    if (Number.isNaN(n)) {
      setDraft(String(current))
      return
    }
    const target = Math.min(Math.max(1, n), pageCount)
    setDraft(String(target))
    if (target !== current) onChange(target)
  }

  const start = (current - 1) * pageSize + 1
  const end = Math.min(current * pageSize, totalItems)

  return (
    <div className="table-pagination">
      <Group gap="sm" wrap="nowrap">
        <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
          {start.toLocaleString()}-{end.toLocaleString()} of {totalItems.toLocaleString()}
        </Text>
        <Button
          variant="default"
          size="compact-sm"
          leftSection={<IconChevronLeft size={14} />}
          disabled={current <= 1}
          onClick={() => onChange(current - 1)}
        >
          Prev
        </Button>
        <Group gap={6} wrap="nowrap">
          <Text size="sm" c="dimmed">
            Page
          </Text>
          <TextInput
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value.replace(/[^0-9]/g, ''))}
            onBlur={commitDraft}
            onKeyDown={(e) => e.key === 'Enter' && commitDraft()}
            size="xs"
            w={Math.max(44, 16 + String(pageCount).length * 9)}
            styles={{ input: { textAlign: 'center', fontVariantNumeric: 'tabular-nums' } }}
            aria-label={`Page number, 1 to ${pageCount}`}
            inputMode="numeric"
          />
          <Text size="sm" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
            of {pageCount.toLocaleString()}
          </Text>
        </Group>
        <Button
          variant="default"
          size="compact-sm"
          rightSection={<IconChevronRight size={14} />}
          disabled={current >= pageCount}
          onClick={() => onChange(current + 1)}
        >
          Next
        </Button>
      </Group>
    </div>
  )
}
