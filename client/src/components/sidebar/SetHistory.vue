<template>
  <div class="container">
    <div style="padding: 10px;">
      <div class="buttons">
        <div style="display: table;">
          <v-radio-group 
          v-model="$store.state.baseDataset" 
          v-on:change="continuousChange"
          label="Base dataset" row>
            <v-radio label="training" value="train"></v-radio>
            <v-radio label="testing" value="test"></v-radio>
            <v-radio label="all" value="both"></v-radio>
            <v-radio v-if="datasetType == 'continuous'" label="sample" value="sample"></v-radio>
          
          </v-radio-group>
        </div>
        <div
          style="display: table;"
        >
          <span style="display: table-cell; vertically-align: middle; font-size: 12px;">Current selections</span>
          <v-menu
            v-for="whichOverlap in ['first', 'second']"
            :key="whichOverlap"
            open-on-hover bottom offset-y max-height="500px"
          >
            <template v-slot:activator="{ on }">
              <v-btn
                v-on="on"
                :color="colors.overlapSelections[whichOverlap]"
                :class="{ 'white--text': whichOverlap === 'second' }"
                fab small
              >
                {{ overlapSelectionDescription(whichOverlap) }}
              </v-btn>
            </template>
            <v-list>
              <v-list-item
                @click="setOverlapSelection({ whichOverlap, selection: null })"
              >
                <v-list-item-title>None</v-list-item-title>
              </v-list-item>
              <v-list-item
                v-for="selection in selectionHistory"
                :key="selection.id"
                @click="setOverlapSelection({ whichOverlap, selection })"
              >
                <v-list-item-title>{{ selection.id }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
          <v-btn @click="clearOverlapSelections" dark small>
            Clear both
          </v-btn>
        </div>
        <div
          style="display: table; margin-top: 25px;"
        >
          <span style="display: table-cell; vertically-align: middle; font-size: 12px;">Operations</span> 
          <v-btn
            v-for="operation in operations"
            :key="operation.description"
            @click="composeUserSelections(operation.id)"
            dark fab small
            :style="`font-size: 24px; margin-right: 10px; ${operation.style}`"
          >
            {{ operation.icon }}
          </v-btn>
        </div>
      </div>
      <InstanceVennDiagram />
    </div>
    <br />
    <v-btn @click="$store.dispatch('resetSelectionHistory')" dark small>
      Reset history
    </v-btn>
    <span style="font-size: 12px; font-weight: bold; padding: 10px;">Past selections</span>
    <div class="table-container">
      <v-data-table
        :headers="headers"
        :items="selectionHistory"
        class="elevation-1"
        :options.sync="pagination"
        disable-sort
        dense
      >
        <template v-slot:body="{ items }">
          <tbody>
            <tr
              v-for="item in items"
              :key="item.id"
              :style="styleTableRow(item)"
            ><td 
                @click="setOverlapSelection({ whichOverlap: 'first', selection: item })"
                @contextmenu.prevent="setOverlapSelection({ whichOverlap: 'second', selection: item })"
              >{{ item.id }}
              <!-- <td>{{ item.id }}</td> -->
              <td
                @click="setOverlapSelection({ whichOverlap: 'first', selection: item })"
                @contextmenu.prevent="setOverlapSelection({ whichOverlap: 'second', selection: item })"
              >{{ item.instances.size }}</td>
              <td
                @click="setOverlapSelection({ whichOverlap: 'first', selection: item })"
                @contextmenu.prevent="setOverlapSelection({ whichOverlap: 'second', selection: item })"
              >{{ item.description }}</td>
              <td  v-if="datasetType == 'continuous'"
              > <input v-model="item.weight" placeholder="item.weight"> </td> 
            </tr>
          </tbody>
        </template>
      </v-data-table>
    </div>
    <v-btn  v-if="datasetType == 'continuous'" @click="$store.dispatch('updateWeightedMetrics')"  small>
      Weighted performance
    </v-btn>
  </div>
</template>

<script lang="ts">
import Vue from 'vue';

import InstanceVennDiagram from './InstanceVennDiagram.vue';
import QueryGenerator from '../QueryGenerator.vue';

import {
  SelectionRecord,
  SetCompose,
} from '../../types';
import { colors } from '../../theme';
import {
  difference,
  intersection,
  union,
  xor,
} from '../../utils';
import { compareFeatureInterestingness } from '../constraints/utils';

export default Vue.extend({
  name: 'SetHistory',
  components: {
    InstanceVennDiagram,
    QueryGenerator,
  },
  data() {
    const { first, second } = colors.overlapSelections;
    const headers = this.$store.state.datasetType == 'continuous' ? [
        { text: 'Id', value: 'id' },
        { text: 'Size', value: 'size' },
        { text: 'Description', value: 'description' },
        { text: 'Weight (1-10)', value: 'weight' },
      ]:[
        { text: 'Id', value: 'id' },
        { text: 'Size', value: 'size' },
        { text: 'Description', value: 'description' },
      ];
    return {
      colors,
      headers,
      operations: [
        {
          id: SetCompose.OR,
          description: 'Union',
          function: union,
          icon: '∪',
        },
        {
          id: SetCompose.AND,
          description: 'Intersection',
          function: intersection,
          icon: '∩',
        },
        {
          id: SetCompose.MINUS,
          description: 'Difference',
          function: difference,
          icon: '−',
          style: `
            background: -webkit-linear-gradient(left, ${first} 50%, ${second} 50%);
          `,
        },
        {
          id: SetCompose.XOR,
          description: 'Exclusive Or',
          function: xor,
          icon: '⊕',
        },
      ],
      pagination: {
        rowsPerPage: 10,
      },
    };
  },
  computed: {
    datasetType(): string{
      var datasetType = this.$store.state.datasetType;
      return datasetType;
    },
    overlapSelections(): {
      first: SelectionRecord | null,
      second: SelectionRecord | null,
    } {
      return this.$store.state.overlapSelections;
    },
    selectionHistory(): SelectionRecord[] {
      let selectionHistory = this.$store.state.selectionHistory;

      // selectionHistory.forEach((i)=>{
      //   if (selectionHistory)
      //   i['weight'] = 0
      // })
      return selectionHistory;
    },
  },
  methods: {
    resetWeight() {
      this.$store.dispatch('updateWeightedMode')
      this.selectionHistory.forEach((i)=>{
        i['weight'] = 0
      })
    },
    
    continuousChange() {
      if (this.datasetType == 'continuous') {
        this.$store.dispatch("changedContinuousMetrics");
        this.$store.dispatch('updateContinuousMetrics');
      }
    },
    compareFeatureInterestingness,
    composeUserSelections(type: SetCompose) {
      const {first, second} = this.overlapSelections;
      if (first === null || second == null) {
        console.error('Both user selections must be non-null for composition.');
        return;
      }
      const operation = this.operations.find((op) => op.id === type);
      if (operation === undefined) {
        console.error('Invalid set composition operation.');
        return;
      }
      const composition: Set<string> = operation.function(first.instances, second.instances);
      const payload = {
        instances: composition,
        description: `${type}(s${first.id}, s${second.id})`,
      };
      this.$store.dispatch('prependToSelectionHistory', payload);
    },
    clearOverlapSelections() {
      this.setOverlapSelection({ whichOverlap: 'first', selection: null });
      this.setOverlapSelection({ whichOverlap: 'second', selection: null });
    },
    overlapSelectionDescription(whichOverlap: 'first' | 'second') {
      const firstOverlapSelection = this.overlapSelections[whichOverlap];
      if (firstOverlapSelection === null) {
        return '?';
      }
      return `${firstOverlapSelection.id}`;
    },
    changedBaseSelection(selection: SelectionRecord) {
      this.$store.dispatch('changedBaseSelection', selection);
    },
    setOverlapSelection(
      payload: {
        selection: SelectionRecord | null,
        whichOverlap: 'first' | 'second',
      },
    ) {
      this.$store.dispatch('changedOverlapSelection', payload);
    },
    styleTableRow(record: SelectionRecord) {
      const { first: firstColor, second: secondColor } = colors.overlapSelections;
      const { first: firstSelection, second: secondSelection } = this.overlapSelections;
      const isFirst = (firstSelection && firstSelection.id === record.id);
      const isSecond = (secondSelection && secondSelection.id === record.id);

      if (isFirst && isSecond) {
        return `
          background: -webkit-linear-gradient(top, ${firstColor}, ${secondColor});
          color: white;
        `;
      }
      if (isFirst) {
        return `
          background-color: ${firstColor};
        `;
      }
      if (isSecond) {
        return `
          background-color: ${secondColor};
          color: white;
        `;
      }
      return '';
    },
  },
});
</script>

<style scoped>
.container {
  margin: 0;
  padding: 0;
}
.buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-around;
}
tr.hover-instance td {
  background-color: yellow;
}
td {
  word-wrap: break-word;
}
</style>
