<template>
  <div>
      <v-expansion-panel
        v-model="panel"
        expand
      >
        <div class="title">Settings</div>
        <v-expansion-panel-content>
          <div slot="header">Data Source</div>
          <DatasetSelector />
        </v-expansion-panel-content>
      </v-expansion-panel>
  </div>
</template>

<script lang="ts">
import Vue from 'vue';
import DatasetSelector from './DatasetSelector.vue';

export default Vue.extend({
    name: 'Navbar',
    components: {
      DatasetSelector,
    },
    data() {
      return {
        drawer: false,
        panel: [],
        links: [
          {
            text: 'Histogram',
            route: '/histogram',
          },
          {
            text: 'New Bar Chart',
            route: '/new-bar-chart',
          },
          {
            text: 'Agreement Matrix',
            route: '/agreement-matrix',
          },
          {
            text: 'Bar Chart',
            route: '/bar-chart',
          },
          {
            text: 'Confusion Matrices',
            route: '/confusion-matrices',
          },
          {
            text: 'Classifier Agreement',
            route: '/classifier-agreement',
          },
          {
            text: 'Home',
            route: '/',
          },
          {
            text: 'Flex Home',
            route: '/flex-home',
          },
        ],
      };
    },
});
</script>

<style scoped>
</style>
