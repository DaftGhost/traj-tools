/**
 * 命令面板模块
 * 提供 Ctrl+Shift+P 快捷键打开的命令面板功能
 */

import { getCommands, type CommandItem } from './commandDefinitions';

const commands: CommandItem[] = getCommands();

export function initializeCommandPalette(): void {
  const overlay = document.getElementById('command-palette-overlay');
  const input = document.getElementById('command-input') as HTMLInputElement;
  const list = document.getElementById('command-list');
  if (!overlay || !input || !list) return;

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      toggleCommandPalette();
    }
  });

  overlay.addEventListener('click', (e) => { if (e.target === overlay) hideCommandPalette(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideCommandPalette(); });
  input.addEventListener('input', () => renderCommandList(input.value));
  renderCommandList('');
}

export function toggleCommandPalette(): void {
  const overlay = document.getElementById('command-palette-overlay');
  const input = document.getElementById('command-input') as HTMLInputElement;
  if (overlay && input) {
    overlay.classList.toggle('visible');
    if (overlay.classList.contains('visible')) {
      input.value = '';
      input.focus();
      renderCommandList('');
    }
  }
}

function hideCommandPalette(): void {
  const overlay = document.getElementById('command-palette-overlay');
  const input = document.getElementById('command-input') as HTMLInputElement;
  if (overlay) overlay.classList.remove('visible');
  if (input) input.value = '';
}

function renderCommandList(filter: string): void {
  const list = document.getElementById('command-list');
  if (!list) return;

  const filtered = filter
    ? commands.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()) || c.description?.toLowerCase().includes(filter.toLowerCase()))
    : commands;

  const grouped = filtered.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  list.innerHTML = '';

  for (const [category, items] of Object.entries(grouped)) {
    const categoryEl = document.createElement('div');
    categoryEl.className = 'command-category';
    const titleSpan = document.createElement('span');
    titleSpan.className = 'category-title';
    titleSpan.textContent = category;
    categoryEl.appendChild(titleSpan);
    list.appendChild(categoryEl);

    for (const item of items) {
      const itemEl = document.createElement('div');
      itemEl.className = 'command-item';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'command-name';
      nameSpan.textContent = item.name;
      itemEl.appendChild(nameSpan);
      if (item.description) {
        const descSpan = document.createElement('span');
        descSpan.className = 'command-desc';
        descSpan.textContent = item.description;
        itemEl.appendChild(descSpan);
      }
      itemEl.addEventListener('click', () => { item.action(); hideCommandPalette(); });
      list.appendChild(itemEl);
    }
  }
}
