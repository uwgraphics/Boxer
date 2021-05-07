<template>
  <div class="container">
    <draggable
      tag="div"
      v-model="$store.state.views.open"
      class="list-group visualizations"
      handle=".handle"
    >
      <div
        v-for="(v, i) in $store.getters.visualizations"
        :key="i"
        :class="`list-group-item tile`"
        :style="`width: ${viewWidthByName(v.name)};`"
      >
        <div class="top-bar" v-if="!visualizationsWithoutExternalHandle.includes(v.name)">
          <div class="handle">{{ handleIcon }}</div>
          <div class="tile-title">{{ v.name }}</div>
        </div>
        <component :is="v.name" :boxProps="v.boxProps" class="vis-component" :onClose="() => $store.dispatch('closeView', i)" />
      </div>
    </draggable>
    <div class="sidebar">
      <Sidebar />
    </div>
  </div>  
</template>


<script lang="ts">
import Performance_Overall from '@/components/boxes/OverallClassifierPerformance.vue';
import Performance_Curves from '@/components/boxes/OverallClassifierPerfCurves.vue';
import Trinary_Performance_Confidence from '@/components/boxes/OverallClassifierConfidence.vue';
import Reliability_Curve from '@/components/boxes/ReliabilityCurve.vue';
import Trinary_Instance_Distribuion from  '@/components/boxes/TrinaryInstanceDistribuion.vue';
import Trinary_Bandwidth_Assessment from '@/components/boxes/BandwidthAssessment.vue';
import Performance_Selection from '@/components/boxes/SelectionClassifierPerformance.vue';
import Performance_Per_Class from '@/components/boxes/DetailedClassifierPerformance.vue';
import ConfusionMatrixGrid from '@/components/boxes/ConfusionMatrixGrid.vue';
import draggable from 'vuedraggable';
import CumulativeAccuracy from '@/components/boxes/OverallClassifierAccuracy.vue';
import Sidebar from '@/components/sidebar/Sidebar.vue';
import PairwiseClassifierConsensus from '@/components/boxes/PairwiseClassifierConsensus.vue';
import MetricsTable from '@/components/boxes/StandardMetrics.vue';
import MetricsParallel from '@/components/boxes/ParallelMetrics.vue';
import UncertaintyHeatMap from '@/components/boxes/UncertaintyHeatMap.vue';
import InstanceList from '@/components/boxes/InstanceList.vue';
import Histogram from '@/components/boxes/FeatureHistogram.vue';
import ScatterPlot from '@/components/boxes/ScatterPlot.vue';
import FocusItem from '@/components/boxes/FocusItem.vue';
import Rejected_Curve from '@/components/boxes/RejectedCurve.vue'
import {
  Visualization,
  VisualizationType,
} from '../types';
import Vue from 'vue';

export default Vue.extend({
  name: 'RigidTileHome',
  components: {
    Histogram,
    UncertaintyHeatMap,
    Performance_Overall,
    Performance_Curves,
    Trinary_Performance_Confidence,
    Reliability_Curve,
    Trinary_Bandwidth_Assessment,
    Rejected_Curve,
    Trinary_Instance_Distribuion,
    Performance_Selection,
    Performance_Per_Class,
    ConfusionMatrixGrid,
    draggable,
    CumulativeAccuracy,
    Sidebar,
    PairwiseClassifierConsensus,
    MetricsTable,
    MetricsParallel,
    InstanceList,
    ScatterPlot,
    FocusItem,
  },
  data() {
    const visualizations: Visualization[] = [];
    const visualizationsWithoutExternalHandle = [
      VisualizationType.CA,
      VisualizationType.CC,
      VisualizationType.CB,
      VisualizationType.RC,
      VisualizationType.BA,
      VisualizationType.REC,
      VisualizationType.TID,
      VisualizationType.UM,
      VisualizationType.SCP,
      VisualizationType.COV,
      VisualizationType.CMG,
      VisualizationType.FH,
      VisualizationType.OCA,
      VisualizationType.PCC,
      VisualizationType.SP,
      VisualizationType.SM,
      VisualizationType.SMP,
      VisualizationType.ITL,
      VisualizationType.FI
    ];
    return {
      handleIcon: '☉',
      visualizations,
      visualizationsWithoutExternalHandle,
    };
  },
  computed: {
    viewWidth() {
      return this.$store.getters.viewWidth;
    },
    storeVisualizations(): Visualization[] {
      return this.$store.getters.visualizations;
    },
  },
  watch: {
    storeVisualizations() {
      this.visualizations = this.storeVisualizations;
      return;
    },
  },
  methods: {
    viewWidthByName(tileName: string) {
      if (tileName === 'InstanceList' ){
        return '100%';
      }
      return this.viewWidth;
    },
  },
});
</script>

<style scoped>
div {
  margin: 0;
  padding: 0;
}
.container {
  max-width: 100%;
  display: flex;
  background-color: cyan;
}
.visualizations {
  flex: 3;
  background-color: lavenderblush;
  max-height: 100%;
  overflow-y: auto;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-around;
  align-content: flex-start;
}
.handle {
  cursor: -webkit-grab;
  cursor: grab;
}
.vis-component {
  flex: 1;
}
.sidebar {
  max-width:400px;		/* hacked to look nice on wide screens */
  width:25%;
  flex: 1;
  background-color: lightgoldenrodyellow;
  min-width: 0;
  overflow-y: auto;
}
.tile {
  width: 50%;
  border: 2px solid black;
  display: flex;
  flex-direction: column;
}
.top-bar {
  background-color: lightgreen;
  font-size: 20px;
  display: flex;
}
</style>
