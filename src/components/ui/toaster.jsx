import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      <div className="fixed bottom-0 right-0 z-[100] flex flex-col gap-2 p-4 sm:max-w-[420px] w-full pointer-events-none">
        {toasts.map(function ({ id, title, description, action, ...props }) {
          return (
            <Toast key={id} {...props} className="pointer-events-auto">
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
              {action}
              <ToastClose className="opacity-100" />
            </Toast>
          );
        })}
      </div>
      <ToastViewport className="hidden" />
    </ToastProvider>
  );
}