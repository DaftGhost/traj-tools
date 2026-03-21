<template>
  <aside class="properties-panel" id="properties-panel">
    <div class="properties-header">
      <span class="properties-title">属性</span>
      <button class="icon-btn properties-toggle" id="properties-toggle" title="收起 (Ctrl+Alt+P)">
        <svg viewBox="0 0 24 24" width="14" height="14">
          <path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
        </svg>
      </button>
    </div>
    <div class="properties-content">
      <div class="property-section" id="prop-selected-route">
        <h4>选中航线</h4>
        <div class="property-row">
          <label>名称</label>
          <span id="prop-route-name">-</span>
        </div>
        <div class="property-row">
          <label>类型</label>
          <span id="prop-route-type">-</span>
        </div>
        <div class="property-row">
          <label>点数</label>
          <span id="prop-route-points">-</span>
        </div>
        <div class="property-row">
          <label>孔洞</label>
          <span id="prop-route-holes">-</span>
        </div>
        <div class="property-row">
          <label id="prop-route-length-label">长度</label>
          <span id="prop-route-length">-</span>
        </div>
        <div class="property-row">
          <label>面积</label>
          <span id="prop-route-area">-</span>
        </div>
        <div class="property-row">
          <label>状态</label>
          <span id="prop-route-status">-</span>
        </div>
      </div>

      <div class="property-section" id="prop-selected-point">
        <h4>选中点</h4>
        <div class="property-row">
          <label>序号</label>
          <span id="prop-point-index">-</span>
        </div>
        <div class="property-row">
          <label>纬度</label>
          <span id="prop-point-lat">-</span>
        </div>
        <div class="property-row">
          <label>经度</label>
          <span id="prop-point-lon">-</span>
        </div>
      </div>

      <div class="property-section" id="prop-selection-info">
        <p class="hint">请在地图上选择航线或点以查看属性</p>
      </div>
    </div>
    <div class="properties-resize-handle" id="properties-resize"></div>
  </aside>
</template>
