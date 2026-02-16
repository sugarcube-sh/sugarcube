/** Progressive enhancement for Safari: close sheet dialogs when clicking the backdrop. */
export function initSheetDialogs(): void {
	document.querySelectorAll<HTMLDialogElement>('dialog.sheet').forEach((dialog) => {
		dialog.addEventListener('click', (e) => {
			if (e.target === dialog) {
				dialog.close();
			}
		});
	});
}
