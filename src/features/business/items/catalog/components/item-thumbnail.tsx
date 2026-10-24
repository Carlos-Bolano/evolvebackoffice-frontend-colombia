import { useState } from "react"
import { Package } from "lucide-react"
import { cn } from "cn"

type ItemThumbnailProps = {
  /** Url de la imagen principal (posición 0); sin imagen se muestra el ícono del producto. */
  url?: string | null
  alt: string
  className?: string
}

/** Miniatura cuadrada de la imagen principal del producto. */
export function ItemThumbnail({ url, alt, className }: ItemThumbnailProps) {
  const [failed, setFailed] = useState(false)

  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40 text-muted-foreground",
        className
      )}
    >
      {url && !failed ? (
        <img src={url} alt={alt} loading="lazy" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <Package className="size-1/2" aria-hidden />
      )}
    </span>
  )
}
