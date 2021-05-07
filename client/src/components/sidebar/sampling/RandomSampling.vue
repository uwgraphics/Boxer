<template>
  <v-expansion-panels
    v-model="panel"
    multiple
  >
  
 
   <div class="table-container-sample">
      <v-data-table
        :headers="headers"
        :items="sample_value"
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
              <td 
                @click="setOverlapSampling({ whichOverlap: 'first',selection: item })"
                @contextmenu.prevent="setOverlapSampling({ whichOverlap: 'second', selection: item })"
              >{{ item.name }}
              </td>
              <td>{{ item.size }}</td>
              <td @click="onButtonClick({ whichOverlap: 'first',selection: item })">
                <v-btn
                  icon
                  :style="styleDataChosen(item)"
                >
                  <v-icon
                  >mdi-star</v-icon>
                </v-btn>
              </td>
              <!-- <td>{{ item.description }}</td> -->
            </tr>
          </tbody>
        </template>
      </v-data-table>
    </div>

    <v-expansion-panel>
      <v-expansion-panel-header>Random Sampling</v-expansion-panel-header>
      <v-expansion-panel-content>
        
      </v-expansion-panel-content>
      <div ref="svg_random" />
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
import { PredicateSimple, Rule } from '../../constraints/types';//'constraints/types';
import {blankConstraint} from '../../constraints/utils';
import { path, select } from 'd3';
import {
  instanceById,
  intersection,
} from '../../../utils';
export default Vue.extend({
  name: 'RandomSampling',
  
  data() {
    const sliderRange = {
      value: 200,
    }
    const classifierThresholdDict = this.$store.state.classifierThresholdDict
    const addSampling = {
      sampling: '',
    };
    return {
      headers: [
        { text: 'Name', value: 'name' },
        { text: 'Size', value: 'size' },
        { text: 'Set as Dataset', value: 'set' },
        // { text: 'Description', value: 'description' },
      ],
      pagination: {
        rowsPerPage: 5,
      },
      addSampling,
      classifierThresholdDict,
      sliderRange,
      thresholdRange: {},      
      panel: [] as string[],
      threshold: 0,
    };
  },
  computed: {
    sample_value() : [] {
      return this.$store.state.sampleList;
    },
    overlapSelections(): {
      first: SelectionRecord | null,
      second: SelectionRecord | null,
    } {
      return this.$store.state.overlapSelections;
    },
     selectedSampleSet(): {
      first: SelectionRecord | null,
      second: SelectionRecord | null,
    } {
      return this.$store.state.selectedSampleSet;
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
    addSampling() {
      let idx = this.sample_value.length ;
      let instances = this.instances;
      let partition = this.addSampling.sampling * 100; 
      
      let partition1 = randomIntegers(0,instances.length, partition / 100 * instances.length);
      let partition2 = []

      let filteredInstances: string[] = [...this.$store.getters.instances];
      let samples = []

      // judge and get test set
      const features = [...this.$store.getters.features];
      if (features.includes('train_or_test')) {
        
        const trainOrTest = 'train_or_test';
        filteredInstances = filteredInstances.filter((i) => {
              return instanceById(i).features[trainOrTest] === 'test' ||
                instanceById(i).features[trainOrTest] === '0';
            });
      }


      instances.forEach((i)=>{
        if (!partition1.includes(i)) {
          partition2.push(i)
        }
      }) 
      let tmpValue = [];
      this.sample_value.forEach((v)=>{
        tmpValue.push(v)
      })
      tmpValue.push({decription:'random', id:idx, name: idx + "_random"+"_left_" + (partition).toFixed(0) + '%' , size: partition1.length, instances: new Set(partition1)})
      tmpValue.push({decription:'random',id:idx + 1,name: (idx+1)  + "_random"+"_right_" + (100-parseInt((partition).toFixed(0))) + '%', size: instances.length -  partition1.length, instances: new Set(partition2) })
      this.$store.dispatch('changedSampledList', tmpValue);
      
      function randomIntegers(min, max, num) {
        let randomArrays = []
        let randomSet = new Set()
        let i = 0
        while ( randomSet.size < num) {
          let tmp = Math.floor(Math.random() * instances.length)
          randomArrays.push((tmp.toString()))
          i += 1
          randomSet = new Set(randomArrays)
        }
        return [...randomSet];
      }
    },
    sliderRange() {
      this.drawUpdateRanges();
    },
    classifierThresholdDict() {
      this.drawInitial();
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
        selection:  SelectionRecord | null,
        whichOverlap: 'first' | 'second',
      },
    ) {
      console.log(payload)
      this.$store.dispatch('changeCurrentChosenSample',payload.selection.name);
      this.$store.dispatch('changedToSamplingData',payload)
    },
    setOverlapSampling(
      payload: {
        selection:  SelectionRecord | null,
        whichOverlap: 'first' | 'second',
      },
    ) {
      this.$store.dispatch('changedSampleSelection', payload);
      const description = payload.selection.name;
      const instances = payload.selection.instances;
      const constraint = blankConstraint();
      const predicate: PredicateSimple = {
        type: 'simple',
        constraints: [constraint],
        metric: []
      };
      const tmp_payload = {
        description,
        instances,
        predicate,
      };
      this.$store.dispatch('prependToSelectionHistory', tmp_payload);
      this.$store.dispatch('changedMostRecentSelection', payload.whichOverlap);

    },
    styleDataChosen(item){
      if (item.name == this.$store.state.currentChosenSample) {
        return `
          color: pink;
        `
      }
      return ''
    },
    styleTableRow(record: SelectionRecord) {      
      const { first: firstColor, second: secondColor } = colors.overlapSelections;
      const { first: firstSelection, second: secondSelection } = this.selectedSampleSet;
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
    drawUpdateRanges() {
      const value = this.sliderRange.value;
      const partition = this.sliderRange.value / 400 * 100

      const chart = d3.select(this.$refs.svg_random);
      const range = chart.select('.random-slider-rect');
      const range_text = chart.select(".random-partition-text");
      const instances = this.instances;

      range.attr('x',  this.xScale(value)) 
      range_text.text("partition: ("+partition.toFixed(0)+"%, "+ (100-parseInt(partition.toFixed(0))) + "%)")

    },

    drawInitial() {
      const xScale =  this.xScale;
      d3.select(this.$refs.svg_random).selectAll('*').remove();
      // @ts-ignore
      const svg = d3.select(this.$refs.svg_random).append('svg')
        .attr('width', '100%')
        .attr('viewBox', `0 0
          ${440}
          ${120}`)
        .append('g')
          .attr('transform', `translate(${0}, ${0})`);


      svg.append("rect")
      .attr("class","random-set-1")
        .attr("width",200)
        .attr("height",40)
        .attr("x",20)
        .attr("y",10)
        .attr("fill","lightgrey")
        .attr("stroke","lightgrey")
        .attr("stroke-width","2px")
      
      svg.append("rect")
      .attr("class","random-set-2")
        .attr("width",200)
        .attr("height",40)
        .attr("x",220)
        .attr("y",10)
        .attr("fill","lightgrey")
        .attr("stroke","lightgrey")
        .attr("stroke-width","2px")

    

      let head = svg.append('rect')
        .attr("class","random-slider-rect")
        .attr("width",10)
        .attr("height",40)
        .attr("x",215)
        .attr("y",10)
        .attr("fill","steelblue")
        .call(d3.drag()
          .on('start.interrupt', function () {
            head.interrupt();
          })
          .on('start drag',  
          (d:string)=>this.sliderRange =({value: xScale.invert(d3.event.x)})//
          ))
          ;

      
      let set_button = svg.append('rect')
        .attr("class","random-set-button")
        .attr("width",40)
        .attr("height",20)
        .attr("x",20)
        .attr("y",90)
        .attr('rx',6)
        .attr("fill","lightgrey")
        .on('mouseenter', (d: string) => {
              d3.select(".random-slider-text").attr("fill","white")
              d3.select(".random-set-button").attr("fill","grey")
            })
            .on('mouseleave', (d: string) => {
              d3.select(".random-slider-text").attr("fill","grey")
              d3.select(".random-set-button").attr("fill","lightgrey")
            })
            .on('click', (d: string) => this.addSampling =({sampling: this.sliderRange.value / 400}))
          ; 

      let set_text = svg.append("text")
        .attr("x",40)
        .attr("y",105)
        .attr("class",'random-slider-text')
        .text("set")
        .style('text-anchor', 'middle')
        .attr("font-size","18px")
        .attr("fill","grey") 
        .on('mouseenter', (d: string) => {
              d3.select(".random-slider-text").attr("fill","white")
              d3.select(".random-set-button").attr("fill","grey")
            })
            .on('mouseleave', (d: string) => {
              d3.select(".random-slider-text").attr("fill","grey")
              d3.select(".random-set-button").attr("fill","lightgrey")
            })
            .on('click', (d: string) => this.addSampling =({sampling: this.sliderRange.value / 400}))
        ;

      let partition_text = svg.append("text")
        .attr("x",100)
        .attr("y",105)
        .attr("class",'random-partition-text')
        .text("partition: (50%, 50%)")
        .style('text-anchor', 'start')
        .attr("font-size","22px")
        .attr("fill","steelblue") 
    },
  },
});
</script>
