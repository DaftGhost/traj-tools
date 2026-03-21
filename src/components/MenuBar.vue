<template>
  <header class="menu-bar">
    <nav class="menu-bar-nav">
      <button class="menu-item" data-menu="file">文件(F)</button>
      <button class="menu-item" data-menu="edit">编辑(E)</button>
      <button class="menu-item" data-menu="view">航线详情(V)</button>
      <button class="menu-item" data-menu="help">帮助(H)</button>
    </nav>
    <div class="menu-bar-title">航线编辑器 <span class="version">v2.1</span></div>
    <div class="menu-bar-actions">
      <button class="icon-btn" id="cmd-palette-btn" title="命令面板 (Ctrl+Shift+P)">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path
            fill="currentColor"
            d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
          />
        </svg>
      </button>
    </div>
  </header>
</template>
