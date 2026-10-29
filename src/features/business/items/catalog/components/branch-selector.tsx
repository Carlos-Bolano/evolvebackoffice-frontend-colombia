import { Building2, Globe } from "lucide-react"
import { useTranslation } from "@/i18n/use-i18n"

export type BranchSelectorOption = {
  id: string | null
  name: string
}

type BranchSelectorProps = {
  options: BranchSelectorOption[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  label?: string
}

export function BranchSelector({ options, selectedId, onSelect, label }: BranchSelectorProps) {
  const { t } = useTranslation("business-items-catalog")
  return (
    <>
      <select
        aria-label={label ?? t("branch_selector")}
        value={selectedId ?? "__ALL__"}
        onChange={(event) => onSelect(event.target.value === "__ALL__" ? null : event.target.value)}
        className="h-11 w-full min-w-0 rounded-xl border bg-background px-3 text-sm sm:hidden"
      >
        {options.map((option) => (
          <option key={option.id ?? "__ALL__"} value={option.id ?? "__ALL__"}>
            {option.name}
          </option>
        ))}
      </select>
      <div className="hidden max-w-full items-center gap-1 overflow-x-auto rounded-lg border bg-muted p-1 sm:flex">
        {options.map((option) => {
          const isSelected = option.id === selectedId
          const isGlobal = option.id === null

          return (
            <button
              key={option.id ?? "global"}
              onClick={() => onSelect(option.id)}
              className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all sm:min-h-8 ${
                isSelected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              } `}
            >
              {isGlobal ? <Globe className="size-3.5" /> : <Building2 className="size-3.5" />}
              <span>{option.name}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}
