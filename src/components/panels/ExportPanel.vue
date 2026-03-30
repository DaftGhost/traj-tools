<template>
  <div class="panel-view" data-panel="export">
    <section class="panel-section">
      <label>导出格式</label>
      <select id="export-format">
        <option value="csv">CSV格式</option>
        <option value="geojson">GeoJSON格式</option>
      </select>
    </section>

    <section class="panel-section">
      <label class="checkbox-row" id="export-bidirectional-row">
        <input id="export-bidirectional" type="checkbox" checked />
        <span>导出双向航线（仅折线）</span>
      </label>
    </section>

    <section class="panel-section">
      <button id="export-btn" class="btn btn-primary btn-block">导出选中航线</button>
      <button id="export-segment" class="btn btn-block">导出片段</button>
    </section>

    <section class="panel-section panel-section-segment">
      <div class="panel-subsection-header" data-toggle="segment">
        <span>片段截取设置</span>
        <span class="toggle-icon">&#9654;</span>
      </div>
      <div class="panel-subsection-content" id="segment-content">
        <div class="controls">
          <button id="toggle-segment-export" class="btn btn-primary">开启片段截取</button>
        </div>
        <div class="slider-row">
          <input id="segment-search-radius" type="range" min="1" max="200" value="50" />
          <span id="segment-search-radius-value">50m</span>
        </div>
        <label class="checkbox-row" id="segment-as-linestring-row">
          <input id="segment-as-linestring" type="checkbox" />
          <span>片段导出为折线（仅多边形）</span>
        </label>
        <div class="segment-status" id="segment-status">未开启</div>
      </div>
    </section>
  </div>
</template>
