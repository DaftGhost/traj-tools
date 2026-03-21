<template>
  <div class="panel-view" data-panel="help">
    <section class="panel-section help-panel">
      <h3>航线编辑器 v2.1</h3>
    </section>

    <section class="panel-section help-panel">
      <h4>功能说明</h4>
      <div class="help-item">
        <span class="help-icon">📁</span>
        <div class="help-content">
          <strong>导入</strong>
          <p class="hint">支持 CSV/GeoJSON/WKT 格式</p>
        </div>
      </div>
      <div class="help-item">
        <span class="help-icon">✏️</span>
        <div class="help-content">
          <strong>编辑</strong>
          <p class="hint">选中航线后点击"开启编辑"</p>
        </div>
      </div>
      <div class="help-item">
        <span class="help-icon">📏</span>
        <div class="help-content">
          <strong>测距</strong>
          <p class="hint">启用后点击地图添加测距点</p>
        </div>
      </div>
      <div class="help-item">
        <span class="help-icon">🔥</span>
        <div class="help-content">
          <strong>热力图</strong>
          <p class="hint">为选中航线显示热力分布</p>
        </div>
      </div>
      <div class="help-item">
        <span class="help-icon">💾</span>
        <div class="help-content">
          <strong>导出</strong>
          <p class="hint">支持 CSV 和 GeoJSON 格式</p>
        </div>
      </div>
    </section>

    <section class="panel-section help-panel">
      <h4>快捷键</h4>
      <table class="help-shortcuts">
        <tr><td><kbd>Ctrl+B</kbd></td><td>切换侧边栏</td></tr>
        <tr><td><kbd>Ctrl+E</kbd></td><td>开启/关闭编辑</td></tr>
        <tr><td><kbd>Ctrl+M</kbd></td><td>开启/关闭测距</td></tr>
        <tr><td><kbd>Ctrl+H</kbd></td><td>开启/关闭热力图</td></tr>
        <tr><td><kbd>Ctrl+X</kbd></td><td>导出数据</td></tr>
        <tr><td><kbd>Ctrl+Shift+P</kbd></td><td>命令面板</td></tr>
        <tr><td><kbd>F1</kbd></td><td>打开帮助</td></tr>
      </table>
    </section>

    <section class="panel-section help-panel">
      <h4>文件格式</h4>
      <div class="help-format">
        <strong>CSV</strong>
        <p class="hint">支持 lat/lon 列（支持多种列名变体）</p>
      </div>
      <div class="help-format">
        <strong>GeoJSON</strong>
        <p class="hint">LineString, Polygon, MultiPolygon, FeatureCollection</p>
      </div>
      <div class="help-format">
        <strong>WKT</strong>
        <p class="hint">POINT/LINESTRING/POLYGON/MULTI* 格式</p>
      </div>
    </section>

    <section class="panel-section help-panel">
      <h4>技术支持</h4>
      <p class="hint">基于 Leaflet + PapaParse + FileSaver</p>
    </section>
  </div>
</template>
