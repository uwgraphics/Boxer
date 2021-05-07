å

<template>
  <v-expansion-panels
    v-model="panel"
    multiple
  >

   <div class="table-container-validation">
      <v-data-table
        :headers="headers"
        :items="validation_value"
        class="elevation-2"
        :options.sync="pagination"
        disable-sort
        dense
      >
        <template v-slot:body="{ items }">
          <tbody>
            <tr
              v-for="item in items"
              :key="item.name"
              :style="styleTableRow(item)"
            >
              <td>{{ item.name }}
              </td>
              <td @click="onButtonClick({ whichOverlap: 'first',selection: item })">
                <v-btn
                  icon
                  :style="styleDataChosen(item)"
                >
                  <v-icon
                  >mdi-star</v-icon>
                </v-btn>
              </td>
              <td @click="saveStatus({selection: item })">
                <v-btn
                  icon
                  color="indigo"
                >
                  <v-icon dark>
                    mdi-plus
                  </v-icon>
                </v-btn>
              </td>
              <td>{{ item.parameters }}
              </td>
            </tr>
          </tbody>
        </template>
      </v-data-table>
      <v-btn @click="onButtonClick({ whichOverlap: '',selection: '' })"  small>
      Reset 
    </v-btn>
    </div>
    
  
    
  <v-expansion-panel>
      <!-- <v-expansion-panel-header>Bootstrap Sampling</v-expansion-panel-header> -->

      <div style="margin-left: 10%; font-size: 14px; stroke: 'black'; stroke-width:2px; " >
        <input v-model="k_size" placeholder="edit me">
        <p>  K-fold validation: k = {{ k_size }}</p>   
      </div>   
      <div ref="svg_validation" />
      </v-expansion-panel> 
  </v-expansion-panels>
</template>
 
<script lang="ts">
import Vue from 'vue';
import { colors } from '../../../theme';
import {
  EntityType,
  SelectionAction,
} from '../../../types';
import * as d3 from 'd3';
import {
  SelectionRecord,
  SetCompose,
  modelSelectionRecord,
  ThresholdWithClassifier,
} from '../../../types';
import {
  instanceById,
  intersection,
} from '../../../utils';
export default Vue.extend({
  name: 'KfoldValidation',
  data() {
    const shuffle = {
      sampling: '',
    };
    return {
      headers: [
        { text: 'Fold Number', value: 'name' },
        { text: 'Shuffle', value: 'set' },
        { text: 'Save Status', value: 'set' },
        { text: 'Parameters', value: 'N/A'}
      ],
      pagination: {
        rowsPerPage: 5,
      },
      shuffle,
      k_size: 0,
      panel: [] as string[],
      checkedBoxes: [] as string[],
    };
  },
  computed: {
    addedBandWidthClassifiers() {
      return this.$store.state.addedBandWidthClassifiers
    },
    classifierThresholdDict() {
      return this.$store.state.classifierThresholdDict
    },
    bandWidthClassifiers() {
      if (this.addedBandWidthClassifiers.length == 0) {
        const value = Object.keys(this.classifierThresholdDict).map((c)=> {
          let threshold = (this.classifierThresholdDict[c] / 100)
          return {'name': c + '(' + (threshold-0.05).toFixed(2) + ',' + (threshold+0.05).toFixed(2) + ')' }
        });
        return value
      }
      return this.addedBandWidthClassifiers;
    },
    validation_value(): [] {
      return this.$store.state.validationList;
    },
    overlapSelections(): {
      first: SelectionRecord | null,
      second: SelectionRecord | null,
    } {
      return this.$store.state.overlapSelections;
    },
    instances(): string[] {
      return [...this.$store.getters.instances];
    },
    thresholdClassifierNameList(): string[]{
      return this.$store.getters.thresholdClassifierNameList
    },
    classifierThresholdList(): ThresholdWithClassifier[] {
      return this.$store.getters.classifierThresholdList
    },
    xScale(): d3.ScaleLinear<number, number> {
      const xScale = d3.scaleLinear()
          .domain([0, 400])
          .range([20, 420])
          .clamp(true);
      return xScale;      
    },
  },
  watch: {
    addedBandWidthClassifiers() {

    },
    shuffle() {
      let k_size = this.k_size;
      let count = 0;
      let k_fold_datasets = [];
      let fold_size = Math.round(this.instances.length / k_size); 
      while (count < k_size) {
        let test_list = [];
        let train_list = [];
        let start_id = count * fold_size;
        let end_id = (count + 1) * fold_size;
        while (start_id < end_id && start_id < this.instances.length) {
          test_list.push(this.instances[start_id])
          start_id += 1
        }
        this.instances.forEach((i)=>{
          if (!test_list.includes(i)) {
            train_list.push(i)
          }
        })
        k_fold_datasets.push(
          {'name': 'Fold ' + (count+1),
           'training': new Set(train_list),
           'testing': new Set(test_list),
           'parameters':'N/A'}
        )
        count += 1
      }
      this.$store.dispatch('changedValidationList', k_fold_datasets);
    },
    classifierThresholdDict() {
      // this.drawInitial();
    },
    thresholdClassifierNameList() {
      this.drawInitial();
    },
  },
  mounted() {
    this.drawInitial();
  },

  methods: {
    onButtonClick(
      payload: {
        selection:  any | null,
        whichOverlap: 'first' | 'second',
      },
    ) {
      if (payload.selection != '') {
        this.$store.dispatch('changedCurrentChosenFold',payload.selection.name);
      } else {
        this.$store.dispatch('changedCurrentChosenFold','');
        this.validation_value.forEach((fold)=>{
          fold.parameters = 'N/A'
          
        })
      }
    },
    saveStatus(
      payload: {
        selection:  any | null,
      },
    ) {
      this.validation_value.forEach((fold)=>{
        if (fold.name == payload.selection.name) {
          fold.parameters = this.bandWidthClassifiers
        }
      })

    },
    styleDataChosen(item){
      if (item.name == this.$store.state.currentChosenFold) {
        return `
          color: pink;
        `
      }
      return ''
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
    drawInitial() {
      const xScale =  this.xScale;
      d3.select(this.$refs.svg_validation).selectAll('*').remove();
      // @ts-ignore
      const svg = d3.select(this.$refs.svg_validation).append('svg')
        .attr('width', '100%')
        .attr('viewBox', `0 0
          ${440}
          ${60}`)
        .append('g')
          .attr('transform', `translate(${0}, ${0})`)
          ;

      
      let set_button = svg.append('rect')
        .attr("class","validation-set-button")
        .attr("width",60)
        .attr("height",30)
        .attr("x",'10%')
        .attr("y",0)
        .attr('rx',6)
        .attr("fill","lightgrey")
        .on('mouseenter', (d: string) => {
              d3.select(".validation-slider-text").attr("fill","white")
              d3.select(".validation-set-button").attr("fill","grey")
            })
            .on('mouseleave', (d: string) => {
              d3.select(".validation-slider-text").attr("fill","grey")
              d3.select(".validation-set-button").attr("fill","lightgrey")
            })
            .on('click', (d: string) => this.shuffle =({sampling: 'set'}))
          ; 

      let set_text = svg.append("text")
        .attr("x",'17%')
        .attr("y",20)
        .attr("class",'validation-slider-text')
        .text("shuffle")
        .style('text-anchor', 'middle')
        .attr("font-size","18px")
        .attr("fill","grey") 
        .on('mouseenter', (d: string) => {
              d3.select(".validation-slider-text").attr("fill","white")
              d3.select(".validation-set-button").attr("fill","grey")
            })
            .on('mouseleave', (d: string) => {
              d3.select(".validation-slider-text").attr("fill","grey")
              d3.select(".validation-set-button").attr("fill","lightgrey")
            })
            .on('click', (d: string) => this.shuffle =({sampling: 'set'}))
        ;

      
    },
  },
});
</script>
