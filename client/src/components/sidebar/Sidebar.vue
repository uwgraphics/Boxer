<template>
  <v-expansion-panels
      v-model="panel"
      multiple
  >
    <v-expansion-panel
    v-if="datasetType == 'continuous'">
      <v-expansion-panel-header>Threshold Set</v-expansion-panel-header>
      <v-expansion-panel-content>
        <ContinuousMode />
      </v-expansion-panel-content>
    </v-expansion-panel>

    <v-expansion-panel
    v-if="datasetType == 'continuous'">
      <v-expansion-panel-header>BandWidth Set (Trinary Mode)</v-expansion-panel-header>
      <v-expansion-panel-content>
         <UncertainAdjuster />
      </v-expansion-panel-content>
    </v-expansion-panel>

    <v-expansion-panel>
      <v-expansion-panel-header>Selection History</v-expansion-panel-header>
      <v-expansion-panel-content>
        <SetHistory />
      </v-expansion-panel-content>
    </v-expansion-panel>

    <!-- <v-expansion-panel>
      <v-expansion-panel-header>Focus Item</v-expansion-panel-header>
      <v-expansion-panel-content>
        <FocusItem />
      </v-expansion-panel-content>
    </v-expansion-panel> -->

    <v-expansion-panel
    v-if="datasetType == 'continuous'">
      <v-expansion-panel-header>Instance Sampling</v-expansion-panel-header>
      <v-expansion-panel-content>
        <RandomSampling />
        <StratifiedSampling />
        <BootstrapSampling />
      </v-expansion-panel-content>
    </v-expansion-panel>

    <v-expansion-panel
    v-if="datasetType == 'continuous'">
      <v-expansion-panel-header>K-Fold Validation</v-expansion-panel-header>
      <v-expansion-panel-content>
        <KfoldValidation />
      </v-expansion-panel-content>
    </v-expansion-panel>

  </v-expansion-panels> 
</template>

<script lang="ts">
import Vue from 'vue';

import ClassFilter from './filters/ClassFilter.vue';
import ClassifierFilter from './filters/ClassifierFilter.vue';
import InstanceList from '@/components/sidebar/InstanceList.vue';
import SetHistory from '@/components/sidebar/SetHistory.vue';
import FocusItem from '@/components/sidebar/FocusItemSide.vue';
import ViewList from './ViewList.vue';
import ContinuousMode from './continuous/ModeSelection.vue';
import UncertainAdjuster from './continuous/UncertainAdjuster.vue';
import RandomSampling from './sampling/RandomSampling.vue';
import BootstrapSampling from './sampling/BootstrapSampling.vue';
import StratifiedSampling from './sampling/StratifiedSampling.vue';
import KfoldValidation from './validation/KfoldValidation.vue'
export default Vue.extend({
  name: 'Sidebar',
  components: {
    RandomSampling,
    BootstrapSampling,
    StratifiedSampling,
    ClassFilter,
    ClassifierFilter,
    InstanceList,
    SetHistory,
    FocusItem,
    ViewList,
    ContinuousMode,
    UncertainAdjuster,
    KfoldValidation,
  },
  data() {
    return {
      panel: [0, 0, 0],
    };
  },
  computed: {
    datasetType(): string{
      var datasetType = this.$store.state.datasetType;
      return datasetType;
    },
  }
});
</script>

<style scoped>
.header-title {
  font-size: 12px;
}
</style>
