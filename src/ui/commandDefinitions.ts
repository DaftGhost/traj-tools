/**
 * Command definitions for the command palette
 */

import { store } from '../state/store';
import { fitAllRoutes } from '../map';
import { switchBaseLayer } from '../map/layers';

export interface CommandItem {
  id: string;
  name: string;
  description?: string;
  action: () => void;
  category: string;
}

export function getCommands(): CommandItem[] {
  return [
    {
      id: 'file.import',
      name: '导入文件',
      description: '导入 CSV 文件',
      action: () => document.getElementById('file-input')?.click(),
      category: '文件'
    },
    {
      id: 'file.export',
      name: '导出数据',
      description: '导出当前航线数据',
      action: () => import('../export/index').then(m => m.exportData()),
      category: '文件'
    },
    {
      id: 'file.exportSegment',
      name: '导出航段',
      description: '导出选中的航段',
      action: () => import('../export/index').then(m => m.exportSegment()),
      category: '文件'
    },
    {
      id: 'view.fitAll',
      name: '显示全部航线',
      description: '缩放以显示所有航线',
      action: fitAllRoutes,
      category: '视图'
    },
    {
      id: 'view.zoomIn',
      name: '放大',
      description: '放大地图视图',
      action: () => store.map?.zoomIn(),
      category: '视图'
    },
    {
      id: 'view.zoomOut',
      name: '缩小',
      description: '缩小地图视图',
      action: () => store.map?.zoomOut(),
      category: '视图'
    },
    {
      id: 'map.osm',
      name: '切换到底图: OpenStreetMap',
      action: () => switchBaseLayer('osm'),
      category: '底图'
    },
    {
      id: 'map.satellite',
      name: '切换到底图: 卫星图',
      action: () => switchBaseLayer('satellite'),
      category: '底图'
    },
    {
      id: 'map.dark',
      name: '切换到底图: 暗色地图',
      action: () => switchBaseLayer('dark'),
      category: '底图'
    },
    {
      id: 'map.light',
      name: '切换到底图: 浅色地图',
      action: () => switchBaseLayer('light'),
      category: '底图'
    },
    {
      id: 'edit.toggleMode',
      name: '切换编辑模式',
      description: '开启/关闭当前航线的编辑模式',
      action: () => {
        const route = store.getSelectedRoute();
        if (route) {
          route.editable = !route.editable;
          import('../routes/geometry').then(m => m.updateRouteDisplayGeometry(route));
          import('../ui/index').then(m => m.updateRouteList());
        }
      },
      category: '编辑'
    },
    {
      id: 'edit.deleteSelected',
      name: '删除选中节点',
      description: '删除当前选中的航点',
      action: () => {
        if (store.selectedPoint) {
          const route = store.getRouteById(store.selectedPoint.routeId);
          if (route && route.editable) {
            route.points.splice(store.selectedPoint.pointIdx, 1);
            store.selectedPoint = null;
            store.clearEditHandle();
            import('../routes/geometry').then(m => m.updateRouteDisplayGeometry(route));
            import('../ui/index').then(m => m.updateRouteList());
            import('../ui/index').then(m => m.updatePropertiesPanel());
          }
        }
      },
      category: '编辑'
    },
    {
      id: 'edit.mergeRoutes',
      name: '合并航线',
      description: '将另一条航线合并到当前选中航线',
      action: () => {
        const route = store.getSelectedRoute();
        if (!route) {
          alert('请先选择一条航线');
          return;
        }
        if (store.routes.length < 2) {
          alert('需要至少两条航线才能进行合并');
          return;
        }
        document.getElementById('merge-routes')?.click();
      },
      category: '编辑'
    },
    {
      id: 'tools.toggleMeasure',
      name: '切换测距工具',
      description: '开启/关闭距离测量工具',
      action: () => import('../tools/measure').then(m => m.toggleMeasureMode()),
      category: '工具'
    },
    {
      id: 'tools.toggleSegment',
      name: '切换航段导出模式',
      description: '开启/关闭航段选择模式',
      action: () => import('../tools/segment').then(m => m.toggleSegmentExportMode()),
      category: '工具'
    },
    {
      id: 'tools.toggleHeatmap',
      name: '切换热力图',
      description: '开启/关闭航点热力图',
      action: () => {
        store.heatmap.enabled = !store.heatmap.enabled;
        const checkbox = document.getElementById('heatmap-enabled') as HTMLInputElement;
        if (checkbox) checkbox.checked = store.heatmap.enabled;
        import('../tools/heatmap').then(m => m.toggleHeatLayer(store.heatmap.enabled));
      },
      category: '工具'
    }
  ];
}
