export function initSheetDialogs(): void {
    for (const dialog of document.querySelectorAll<HTMLDialogElement>("dialog.sheet")) {
        dialog.addEventListener("click", (e) => {
            if (e.target === dialog) {
                dialog.close();
            }
        });
    }
}
