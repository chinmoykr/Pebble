import { App, Modal, Notice } from 'obsidian';
import { PebbleManager } from '../utils/pebble_manager';
import type PebblePlugin from '../main';
import { handleListContinuation } from '../utils/editor_helpers';
import { AttachmentManager } from '../utils/attachment_manager';
import { LinkSuggestManager } from '../utils/link_suggest';

export class QuickCaptureModal extends Modal {
	plugin: PebblePlugin;
	textarea!: HTMLTextAreaElement;

	constructor(app: App, plugin: PebblePlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass('pebble-quick-capture-modal');
		contentEl.style.position = 'relative';

		this.textarea = contentEl.createEl('textarea', {
			cls: 'pebble-capture-textarea',
			attr: {
				placeholder: "Drop a new pebble...",
				rows: "3"
			}
		});

		const linkSuggest = new LinkSuggestManager(this.app, this.textarea, contentEl);
		linkSuggest.init();

		this.textarea.addEventListener('input', function () {
			const oldScrollTop = this.scrollTop;
			this.style.height = 'auto';
			this.style.height = this.scrollHeight + 'px';
			if (this.selectionStart === this.value.length) {
				this.scrollTop = this.scrollHeight;
			} else {
				this.scrollTop = oldScrollTop;
			}
		});

		const controlsEl = contentEl.createDiv('pebble-capture-controls');

		const leftControls = controlsEl.createDiv('pebble-capture-left-controls');
		const rightControls = controlsEl.createDiv('pebble-capture-right-controls');

		const fileInput = leftControls.createEl('input', {
			type: 'file',
			attr: {
				accept: 'image/*,application/pdf',
				multiple: 'multiple',
				style: 'display: none;'
			}
		});

		fileInput.onchange = async () => {
			if (fileInput.files && fileInput.files.length > 0) {
				await AttachmentManager.handleAttachments(this.app, this.plugin.settings, fileInput.files, this.textarea);
				fileInput.value = ''; // reset
			}
		};

		const attachmentBtn = leftControls.createSpan('pebble-icon-btn pebble-attachment-btn');
		attachmentBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>`;
		attachmentBtn.onclick = () => fileInput.click();

		const saveBtn = rightControls.createEl('button', { cls: 'pebble-save-btn' });
		saveBtn.innerHTML = `
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
		`;

		saveBtn.onclick = () => this.savePebble();

		this.textarea.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				this.savePebble();
				return;
			}

			if (handleListContinuation(this.textarea, e)) {
				this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
				return;
			}
		});

		this.textarea.addEventListener('dragover', (e) => {
			e.preventDefault();
		});

		this.textarea.addEventListener('drop', async (e) => {
			if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
				const handled = await AttachmentManager.handleAttachments(this.app, this.plugin.settings, e.dataTransfer.files, this.textarea);
				if (handled) e.preventDefault();
			}
		});

		this.textarea.addEventListener('paste', async (e) => {
			if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
				const handled = await AttachmentManager.handleAttachments(this.app, this.plugin.settings, e.clipboardData.files, this.textarea);
				if (handled) e.preventDefault();
			}
		});

		setTimeout(() => {
			this.textarea.focus();
		}, 100);
	}

	async savePebble() {
		const text = this.textarea.value.trim();
		if (!text) {
			new Notice('Pebble is empty!');
			return;
		}

		try {
			await PebbleManager.savePebble(this.app, this.plugin.settings, text);
			new Notice('Pebble saved');
			this.textarea.style.height = 'auto'; // Reset height
			this.close();
		} catch (e) {
			console.error(e);
			new Notice('Failed to save pebble');
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
