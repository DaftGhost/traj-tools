<template>
  <div class="merge-dialog-overlay" id="merge-dialog-overlay">
    <div class="merge-dialog">
      <div class="merge-dialog-header">
        <span>合并航线</span>
        <button class="merge-dialog-close" id="merge-dialog-close">&times;</button>
      </div>
      <div class="merge-dialog-content">
        <p class="merge-dialog-hint">选择要合并到当前航线末尾的航线：</p>
        <div class="merge-route-list" id="merge-route-list"></div>
      </div>
      <div class="merge-dialog-footer">
        <button class="btn" id="merge-dialog-cancel">取消</button>
        <button class="btn btn-primary" id="merge-dialog-confirm">确认合并</button>
      </div>
    </div>
  </div>
</template>
