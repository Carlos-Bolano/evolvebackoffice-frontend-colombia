import { useState } from "react"
import { Truck } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Branch } from "@/features/business/branches/types"
import { notify } from "@/hooks/use-notify"
import { useTranslation } from "@/i18n/use-i18n"
import { getApiErrorMessage } from "@/utils/api-error"
import { ProductLinesEditor, type ProductLine } from "../../components/product-lines-editor"
import { useCreateTransfer } from "../../hooks/use-purchasing"
import type { TransferDto } from "../../types/purchasing"
import { linesAreValid, toLineInputs } from "../../utils/lines"

type NewTransferDialogProps = {
  branch: Branch
  branches: Branch[]
  onOpenChange: (open: boolean) => void
  onCreated: (transfer: TransferDto) => void
}

/** Envío directo (sin pedido) desde una sucursal proveedora a otra sucursal. */
export function NewTransferDialog({ branch, branches, onOpenChange, onCreated }: NewTransferDialogProps) {
  const { t } = useTranslation("business-inventory")
  const createTransfer = useCreateTransfer()
  const [toBranchId, setToBranchId] = useState("")
  const [lines, setLines] = useState<ProductLine[]>([])
  const [notes, setNotes] = useState("")

  const destinations = branches.filter((b) => b.id !== branch.id)
  const canSubmit = Boolean(toBranchId) && linesAreValid(lines) && !createTransfer.isPending

  const submit = () => {
    if (!canSubmit) return
    createTransfer.mutate(
      { fromBranchId: branch.id, toBranchId, lines: toLineInputs(lines), notes: notes.trim() || null },
      {
        onSuccess: (transfer) => {
          notify.success(t("transfer_created", { number: transfer.number }))
          onCreated(transfer)
        },
        onError: (error) => notify.error(getApiErrorMessage(error, t("save_error"))),
      }
    )
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
              <Truck className="size-5" />
            </div>
            <div>
              <DialogTitle>{t("transfer_new_title")}</DialogTitle>
              <DialogDescription>{t("transfer_new_desc", { branch: branch.name })}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="envio-destino">{t("transfer_to")}</Label>
            <Select value={toBranchId} onValueChange={setToBranchId}>
              <SelectTrigger id="envio-destino">
                <SelectValue placeholder={t("transfer_to_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {destinations.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ProductLinesEditor lines={lines} onChange={setLines} />
          <p className="text-xs text-muted-foreground">{t("transfer_stock_hint")}</p>

          <div className="space-y-2">
            <Label htmlFor="envio-nota">{t("notes")}</Label>
            <Textarea
              id="envio-nota"
              rows={2}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button id="btn-crear-envio" type="button" onClick={submit} disabled={!canSubmit}>
            {createTransfer.isPending ? t("saving") : t("transfer_send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
