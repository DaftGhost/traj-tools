<template>
  <div class="panel-view active" data-panel="files">
    <section class="panel-section">
      <div class="import-area">
        <label class="btn btn-primary">
          导入 CSV/GeoJSON/WKT
          <input id="file-input" type="file" accept=".csv,.geojson,.json,.wkt" multiple />
        </label>
      </div>
      <div class="base-map-selector">
        <label>底图选择</label>
        <select id="map-select">
          <option value="tdtVector">天地图矢量</option>
          <option value="tdtSatellite">天地图影像</option>
          <option value="tdtTerrain">天地图地形</option>
          <option value="osm">OpenStreetMap</option>
          <option value="satellite">Esri卫星</option>
          <option value="cartoDark">暗色地图</option>
          <option value="cartoLight">亮色地图</option>
        </select>
      </div>
    </section>

    <section class="panel-section panel-section-routes">
      <div class="panel-section-header">
        <span>航线列表</span>
        <span class="route-count">(0)</span>
      </div>
      <div class="routes-search">
        <input type="text" id="route-search" placeholder="搜索航线..." />
      </div>
      <div class="routes-list" id="routes-list"></div>
    </section>
  </div>
</template>
