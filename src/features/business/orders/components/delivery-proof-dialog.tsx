import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useTranslation } from "@/i18n/use-i18n"
import { getDeliveryProof, getDeliveryProofImage } from "../services/delivery-enhancements.service"
import { getApiErrorMessage } from "../utils/order-helpers"

export function DeliveryProofDialog({ id }: { id: string }) {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation("business-orders")
  // Sin caché: es un dato privado, se pide cada vez que se abre.
  const privateQuery = { enabled: open, staleTime: 0, gcTime: 0, retry: false } as const
  const { data, error, isLoading } = useQuery({
    queryKey: ["delivery-proof", id],
    queryFn: () => getDeliveryProof(id),
    ...privateQuery,
  })
  const image = useQuery({
    queryKey: ["delivery-proof-image", id],
    queryFn: () => getDeliveryProofImage(id),
    ...privateQuery,
  })

  // La imagen llega como blob autenticado: se muestra con un object URL que
  // se libera al cerrar o al cambiar.
  const imageUrl = useMemo(() => (image.data ? URL.createObjectURL(image.data) : null), [image.data])
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl)
    }
  }, [imageUrl])

  const failure = error ?? image.error
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        {t("e_view_proof")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("e_view_proof")}</DialogTitle>
            <DialogDescription>{t("e_proof_private")}</DialogDescription>
          </DialogHeader>
          {(isLoading || image.isLoading) && <p>{t("loading")}</p>}
          {failure && <p role="alert">{getApiErrorMessage(failure, t("status_update_failed"))}</p>}
          {data && (
            <p>
              {data.receiverName} · {new Date(data.createdAt).toLocaleString()}
            </p>
          )}
          {data && imageUrl && (
            <img
              alt={t(data.kind === "Signature" ? "e_signature" : "e_photo")}
              className="max-h-96 rounded bg-white object-contain"
              src={imageUrl}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
