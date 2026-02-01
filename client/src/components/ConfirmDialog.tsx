import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";

interface ConfirmDialogProps {
  trigger?: React.ReactNode;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  isPending?: boolean;
  variant?: "destructive" | "default";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ConfirmDialog({
  trigger,
  title = "Confirmer la suppression",
  description = "Cette action est irreversible. Voulez-vous vraiment continuer ?",
  confirmText = "Supprimer",
  cancelText = "Annuler",
  onConfirm,
  isPending = false,
  variant = "destructive",
  open,
  onOpenChange,
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isPending}
            className={variant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface DeleteButtonWithConfirmProps {
  onConfirm: () => void;
  isPending?: boolean;
  itemName?: string;
  itemType?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "destructive" | "ghost" | "outline";
  className?: string;
  showIcon?: boolean;
  buttonText?: string;
  "data-testid"?: string;
}

export function DeleteButtonWithConfirm({
  onConfirm,
  isPending = false,
  itemName,
  itemType = "cet element",
  size = "icon",
  variant = "ghost",
  className = "",
  showIcon = true,
  buttonText,
  "data-testid": testId,
}: DeleteButtonWithConfirmProps) {
  const description = itemName 
    ? `Voulez-vous vraiment supprimer "${itemName}" ? Cette action est irreversible.`
    : `Voulez-vous vraiment supprimer ${itemType} ? Cette action est irreversible.`;

  return (
    <ConfirmDialog
      trigger={
        <Button
          variant={variant}
          size={size}
          disabled={isPending}
          className={className}
          data-testid={testId}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              {showIcon && <Trash2 className={`h-4 w-4 ${buttonText ? "mr-2" : ""}`} />}
              {buttonText}
            </>
          )}
        </Button>
      }
      title="Confirmer la suppression"
      description={description}
      onConfirm={onConfirm}
      isPending={isPending}
    />
  );
}
