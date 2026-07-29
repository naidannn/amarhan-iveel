/**
 * Түр мэдэгдэл (toast).
 *
 * Ачаа бүртгэх урсгалд (§1.4) чухал: "Бүртгэгдлээ" гэсэн мэдэгдэл нь ажилтны
 * ажлыг ТАСЛАХГҮЙ байх ёстой. Тиймээс модал/alert биш, өөрөө алга болдог toast.
 *
 * `alert()` ашиглахыг хориглоно — тэр нь хуудсыг блоклож, дараагийн ачаа
 * бүртгэх хурдыг эрс бууруулна.
 */
export type ToastKind = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: number
  kind: ToastKind
  title: string
  description?: string
  /** мс. 0 = гараар хаах хүртэл үлдэнэ */
  duration: number
}

const items = ref<Toast[]>([])
let nextId = 0

export function useToast() {
  function push(
    kind: ToastKind,
    title: string,
    options: { description?: string; duration?: number } = {}
  ) {
    nextId += 1
    const id = nextId
    // Алдааг удаан харуулна — хэрэглэгч уншиж амжих ёстой
    const duration = options.duration ?? (kind === 'error' ? 7000 : 4000)

    items.value.push({ id, kind, title, description: options.description, duration })

    if (duration > 0 && import.meta.client) {
      setTimeout(() => dismiss(id), duration)
    }
    return id
  }

  function dismiss(id: number) {
    items.value = items.value.filter(t => t.id !== id)
  }

  return {
    items: readonly(items),
    dismiss,
    success: (title: string, o?: { description?: string; duration?: number }) =>
      push('success', title, o),
    error: (title: string, o?: { description?: string; duration?: number }) =>
      push('error', title, o),
    warning: (title: string, o?: { description?: string; duration?: number }) =>
      push('warning', title, o),
    info: (title: string, o?: { description?: string; duration?: number }) =>
      push('info', title, o),
  }
}
