import { useState } from "react"
import { Package, type LucideIcon } from "lucide-react"
import { cn } from "cn"

type ItemThumbnailProps = {
  /** Url de la imagen principal (posición 0); sin imagen se muestra el ícono. */
  url?: string | null
  alt: string
  className?: string
  /** Ícono cuando no hay imagen (por defecto el de producto). */
  icon?: LucideIcon
}

/** Miniatura cuadrada de la imagen principal (producto o departamento). */
export function ItemThumbnail({ url, alt, className, icon: Icon = Package }: ItemThumbnailProps) {
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
        <Icon className="size-1/2" aria-hidden />
      )}
    </span>
  )
}
