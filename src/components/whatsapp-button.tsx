import { Icon } from "@/components/icon";
import { whatsappUrl } from "@/lib/whatsapp";

/** Opens WhatsApp with the message typed in; the person picks the chat and presses Send. */
export function WhatsAppButton({ text, label = "WhatsApp" }: { text: string; label?: string }) {
  return (
    <a href={whatsappUrl(text)} target="_blank" rel="noopener noreferrer" className="btn-ghost px-3 py-1.5 text-xs">
      <Icon name="whatsapp" size={16} />{label}
    </a>
  );
}
