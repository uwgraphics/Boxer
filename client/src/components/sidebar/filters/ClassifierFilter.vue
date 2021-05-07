<template>
  <v-expansion-panels
    v-model="panel"
    multiple
  >
    <v-expansion-panel>
      <v-expansion-panel-header>Classifiers</v-expansion-panel-header>
      <v-expansion-panel-content>
        <v-list>
          <v-list-item
            v-for="classifier in classifierThresholdList"
            :key="classifier"
            @click="applyFilter"
          >
            <v-list-item-title>
              <v-checkbox v-model="checkedBoxes" :value="classifier" :label="classifier" />
            </v-list-item-title>
          </v-list-item>
        </v-list>
      </v-expansion-panel-content>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script lang="ts">
import Vue from 'vue';
import {
  EntityType,
  SelectionAction,
} from '../../../types';

export default Vue.extend({
  name: 'ClassifierFilter',
  data() {
    return {
      panel: [] as string[],
      checkedBoxes: [] as string[],
    };
  },
  computed: {
    classifierThresholdList(): string[] {
      return [...this.$store.getters.classifiers];
    },
    datasetType(): string {
      return this.$store.state.datasetType;
    }
  },
  methods: {
    applyFilter() {
      const payload: {
        entityType: EntityType,
        newFilter: {
          type: SelectionAction,
          set: Set<string>,
        },
      } = {
        entityType: EntityType.Classifier,
        newFilter: {
          type: SelectionAction.Exclude,
          set: new Set(this.checkedBoxes),
        },
      };
      
      console.log('classifier checkboxes', payload);
      this.$store.dispatch('changedFilter', payload);
      if (this.datasetType == 'continuous'){
        this.$store.dispatch('changedContinuousMetrics')
      }
    },
  },
});
</script>
