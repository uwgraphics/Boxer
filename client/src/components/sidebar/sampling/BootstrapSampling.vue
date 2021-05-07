å

<template>
  <v-expansion-panels
    v-model="panel"
    multiple
  >
  
    
    <v-expansion-panel>
      <v-expansion-panel-header>Bootstrap Sampling</v-expansion-panel-header>

      <div style="margin-left: 10%; font-size: 14px; stroke: 'black'; stroke-width:2px; " >
        <input v-model="sample_size" placeholder="edit me">
        <p>  Sample size: {{ sample_size }}</p>   
      </div>   
      <!-- <div style="margin-left: 10%; font-size: 14px; stroke: 'black'; stroke-width:2px; " >
          <input v-model="sample_time" placeholder="edit me">
          <p>  Sample time(s): {{ sample_time }}</p>   
      </div>    -->

      <div ref="svg_bootstrap" />
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
  name: 'BootstrapSampling',
  data() {
    const addSampling = {
      sampling: '',
    };
    return {
      addSampling,
      // sample_time: 0,
      sample_size: 0,
      panel: [] as string[],
      checkedBoxes: [] as string[],
    };
  },
  computed: {
    value() : [] {
      return this.$store.state.sampleList;
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
    addSampling() {
      // add sample to the table
      let idx = this.value.length;
      let sample_size = this.sample_size;
      let sample_time = 1;
      let instances = this.instances;
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

      
 
      // create boostrap sampling
      let time_count = 0;
      while (time_count < sample_time) {
        let tmp_sample = randomIntegers(0,filteredInstances.length, sample_size);
        tmp_sample.forEach((c)=>{
          samples.push(filteredInstances[c])
        })
        time_count += 1
      }

      let tmpValue = [];
      this.value.forEach((v)=>{
        tmpValue.push(v)
      })
      tmpValue.push({decription:'bootstrap', id:idx, name: idx + "_bootstrap", size: samples.length, instances: new Set(samples)})
      this.$store.dispatch('changedSampledList', tmpValue);

      function randomIntegers(min, max, num) {
        let randomArrays = []
        let i = 0
        while ( i < num) {
          let tmp = Math.floor(Math.random() * filteredInstances.length)
          randomArrays.push(tmp.toString())
          i += 1
        }
        return randomArrays;
      }
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
    setOverlapSampling(
      payload: {
        selection:  null,
      },
    ) {
      this.$store.dispatch('changedToSamplingData', payload);
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
      d3.select(this.$refs.svg_bootstrap).selectAll('*').remove();
      // @ts-ignore
      const svg = d3.select(this.$refs.svg_bootstrap).append('svg')
        .attr('width', '100%')
        .attr('viewBox', `0 0
          ${440}
          ${120}`)
        .append('g')
          .attr('transform', `translate(${0}, ${20})`)
          ;

      
      let set_button = svg.append('rect')
        .attr("class","bootstrap-set-button")
        .attr("width",40)
        .attr("height",20)
        .attr("x",'10%')
        .attr("y",0)
        .attr('rx',6)
        .attr("fill","lightgrey")
        .on('mouseenter', (d: string) => {
              d3.select(".bootstrap-slider-text").attr("fill","white")
              d3.select(".bootstrap-set-button").attr("fill","grey")
            })
            .on('mouseleave', (d: string) => {
              d3.select(".bootstrap-slider-text").attr("fill","grey")
              d3.select(".bootstrap-set-button").attr("fill","lightgrey")
            })
            .on('click', (d: string) => this.addSampling =({sampling: 'set'}))
          ; 

      let set_text = svg.append("text")
        .attr("x",'15%')
        .attr("y",15)
        .attr("class",'bootstrap-slider-text')
        .text("set")
        .style('text-anchor', 'middle')
        .attr("font-size","18px")
        .attr("fill","grey") 
        .on('mouseenter', (d: string) => {
              d3.select(".bootstrap-slider-text").attr("fill","white")
              d3.select(".bootstrap-set-button").attr("fill","grey")
            })
            .on('mouseleave', (d: string) => {
              d3.select(".bootstrap-slider-text").attr("fill","grey")
              d3.select(".bootstrap-set-button").attr("fill","lightgrey")
            })
            .on('click', (d: string) => this.addSampling =({sampling: 'set'}))
        ;

      
    },
  },
});
</script>
