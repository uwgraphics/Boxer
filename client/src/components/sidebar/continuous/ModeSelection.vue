<template>
  <div class="card">

  <v-expansion-panels
    v-model="panel"
    multiple
  >
  </v-expansion-panels>
  <label >Threshold select </label>
  <multiselect v-model="value" tag-placeholder="Add this as new threshold" placeholder="Add a threshold" label="name" track-by="name" 
              :options="options" :multiple="true" :taggable="true" @tag="addTag"></multiselect>

  <div ref="svg" />
    </div>
</template>

<script lang="ts">
import Vue from 'vue';
import * as d3 from 'd3';
import Multiselect from 'vue-multiselect'
Vue.component('multiselect', Multiselect)
import {
  EntityType,
  SelectionAction,
  modelSelectionRecord,
  ThresholdWithClassifier,
  thresholdSelectionRecord,
} from '../../../types';
import { colors } from '../../../theme';
export default Vue.extend({
  name: 'ContinuousMode',
  data() {
    const sliderRange = {
      type: '' as 'from' | 'to',
      classifier: '',
      value: 0,
    };
    const curAddedThresholdClassifier = {
      classifier: '',
      threshold: 0.5,
    };
    return {
      sliderRange,
      thresholdRange: {},      
      panel: [] as string[],
      threshold: 0,
      value: [] as string[],
      curAddedThresholdClassifier,
      options:[],
    };
  },
  computed: {
    viewsConfig():any[]{
      return this.$store.state.viewsConfig;
    },
    classifierThresholdDict():{} {
      return this.$store.state.classifierThresholdDict
    },
    curveClassifiers() {
      return this.$store.getters.curveClassifiers;
    },
    classifierThresholdCurve() {
      return this.$store.getters.curveChosenClassifierThresholdTuple;
    },
    addedThresholdClassifiers():[] {
      let addedThresholdClassifiers = this.$store.state.addedThresholdClassifiers
      if (addedThresholdClassifiers === null ) {
        addedThresholdClassifiers = []
      }
      return addedThresholdClassifiers;
    },
    classifierThresholdList(): ThresholdWithClassifier[] {
      return this.$store.getters.classifierThresholdList
    },
    classifiers(): {} {
      return this.$store.getters.classifiers;
    },
    instances(): string[] {
      return [...this.$store.getters.filteredInstances];
    }, 
    xScale(): d3.ScaleLinear<number, number> {
      const xScale = d3.scaleLinear()
          .domain([0, 400])
          .range([10, 410])
          .clamp(true);
      return xScale;      
    },
    resumeStatus() {
      return this.$store.state.resumeStatus
    },
  },
  watch: {
    resumeStatus() {
      const classifiers = this.classifierThresholdList.map((c)=>c.classifier);
      classifiers.forEach((c)=>{
        if (Object.keys(this.classifierThresholdDict).includes(c)) {
          if (this.classifierThresholdDict[c] / 100 != 0.5) {
            setTimeout(() => {
              this.sliderRange =({type:"from", classifier:c, value: this.classifierThresholdDict[c] * 4})
            }, 500);
          }
        }
      })
    },
    viewsConfig() {
      const classifiers = this.classifierThresholdList.map((c)=>c.classifier);
      classifiers.forEach((c)=>{
        if (Object.keys(this.classifierThresholdDict).includes(c)) {
          if (this.classifierThresholdDict[c] / 100 != 0.5) {
            setTimeout(() => {
              this.sliderRange =({type:"from", classifier:c, value: this.classifierThresholdDict[c] * 4})
            }, 100);
          }
        }
      })
      
    },
    classifierThresholdCurve() {
      this.drawUpdateRangesCurve();
    },
    sliderRange() {
      this.drawUpdateRanges();
    },
    classifiers() {
      if (this.$store.state.datasetType == "continuous") {
        this.drawInitial();
      }
    },
    curAddedThresholdClassifier() {
      this.value.push({name:"set_"+this.curAddedThresholdClassifier.classifier + "_"+parseFloat(this.curAddedThresholdClassifier.threshold).toFixed(2)})
      this.options.push({name:"set_"+this.curAddedThresholdClassifier.classifier + "_"+parseFloat(this.curAddedThresholdClassifier.threshold).toFixed(2)})
      this.$store.dispatch('changedCurAddedThresholdClassifier', this.curAddedThresholdClassifier)
    },
    value() {
      this.$store.dispatch('changedAddedThresholdClassifiers', this.value)
    },
  },
  mounted() {
    this.drawInitial();
  },

  methods: {
    addTag (newTag) {
      const tag = {
        name: newTag,
      }
      this.options.push(tag)
      this.value.push(tag)
    },
    drawUpdateRangesCurve() {
      const classifier = this.classifierThresholdCurve.classifier;
      const value = this.classifierThresholdCurve.single_threshold;
      this.sliderRange =({type:"from", classifier:classifier, value: value * 4})
    },
    drawUpdateRanges() {
      const classifier = this.sliderRange.classifier;
      const value = this.sliderRange.value;
      const pre_value = this.thresholdRange[classifier];
      const flag = (value/400).toFixed(2) != pre_value ? 1 : 0;

      let tmp = {};
      for(let c in this.thresholdRange) {
        tmp[c] = this.thresholdRange[c]
      }

      const chart = d3.select(this.$refs.svg);
      const range = chart.select('.slider-head-'+classifier)
      const range_text = chart.select(".slider-text-"+classifier)
      var cur_from = value / 400
      tmp[classifier] = cur_from < 0 ? 0 
                        :cur_from > 1 ? 1 : cur_from.toFixed(2);
      
      this.thresholdRange = tmp


      range.attr('transform', 'translate(' + this.xScale(value) + ', 55)') 
      range_text.text((d:string)=>classifier+": "+this.thresholdRange[classifier])
      
      let changedClassifier = {"classifier":classifier, "single_threshold": this.thresholdRange[classifier] * 100};
      if (flag == 1) {
        this.$store.dispatch("changedContinuousThreshold",changedClassifier)
      }
    },
    drawInitial() {
      d3.select(this.$refs.svg).selectAll('*').remove();
      // @ts-ignore
      const svg = d3.select(this.$refs.svg).append('svg')
        .attr('width', '100%')
        .attr('viewBox', `0 0
          ${440}
          ${140*this.classifierThresholdList.length+20}`)
        .append('g')
          .attr('transform', `translate(${0}, ${0})`);
      
      const classifierThresholdDict = this.classifierThresholdDict;
      const classifiers = this.classifierThresholdList.map((c)=>c.classifier);

      if (Object.keys(this.thresholdRange).length == 0) {
        classifiers.forEach((c)=>{
          this.thresholdRange[c] = 0.5
        })
      }
      
      svg.append("rect")
      .attr("class","rect")
        .attr("width",430)
        .attr("height",120*this.classifierThresholdList.length)
        .attr("x",0)
        .attr("y",10)
        .attr("fill","white")
        .attr("stroke","lightgrey")
        .attr("stroke-width","2px")

      const xScale =  this.xScale;

      const rangeSliders =  svg.append("g").selectAll("g")
            .data(classifiers)
            .enter().append("g")
              .attr("transform", function(d,i) { 
                return "translate(0," + (i * 120) +")"; })

        let titles = rangeSliders.append("text")
          .attr("transform",   "translate(30,"  +"30)")
          .attr("class",(d)=>"slider-text-"+d)
          .text((d:string)=>d+": 0.5")
          .attr("x",5)
          .attr("font-size","22px")
          .attr("fill","grey")


        let borders = rangeSliders.append("line")
          .attr("transform",   "translate(0,"  +"120)")
          .attr("class","range-border")
          .style("stroke", "lightgrey")
          .style("stroke-opacity", "1")
          .style("stroke-width", "3")
          .attr('x1', 0)
          .attr('x2', 430)
          .attr('y1', 0)
          .attr('y2', 0)
          .attr("visibility",(d:string)=> d==classifiers[classifiers.length-1]?"hidden":"visible")
                

        let slider = rangeSliders.append('line')
          .attr("transform",   "translate(0,"  +"60)")
          .attr('class', 'track')
          .style("stroke", "#777")
          .style("stroke-opacity", "1")
          .style("stroke-width", "5")
          .attr('x1', 10)
          .attr('x2', 410)
          .attr('y1', 0)
          .attr('y2', 0);

        let head = rangeSliders.append('rect')
          .attr("width",20)
          .attr("height",10)
          .attr("rx",6)
          .attr('fill', 'steelblue')
          .attr('stroke', 'none')
          .attr('class',(d:string)=>'slider-head-'+d)
          .attr('transform', function(d:string){
            return 'translate('+xScale(200)+',55)'
          })
          .call(d3.drag()
            .on('start.interrupt', function () {
              head.interrupt();
            })
            .on('start drag',  
            (d:string)=>this.sliderRange =({type:"from", classifier:d, value: xScale.invert(d3.event.x)})//
            ))
            ;
        
        let addButton = rangeSliders.append("rect")
          .attr("width",40)
          .attr("height",20)
          .attr("transform",   "translate(340,"  +"85)")
            .attr("class",(d:string)=>"add-rect-best-"+d)
            .attr("fill","lightgrey") 
          
        let addText = rangeSliders.append("text")
          .attr("transform",   "translate(345,"  +"100)")
            .attr("class",(d:string)=>"add-set-"+d)
            .text("add")
            .attr("font-size","18px")
            .attr("fill","grey") 
            .on('mouseenter', (d: string) => {
              d3.select(".add-set-"+d).attr("fill","white")
              d3.select(".add-rect-best-"+d).attr("fill","grey")
            })
            .on('mouseleave', (d: string) => {
              d3.select(".add-set-"+d).attr("fill","grey")
              d3.select(".add-rect-best-"+d).attr("fill","lightgrey")
            })
            .on('click', (d: string) => this.curAddedThresholdClassifier =({classifier:d, threshold: this.thresholdRange[d]}))

        
        classifiers.forEach((c)=>{
          if (Object.keys(classifierThresholdDict).includes(c)) {
            if (classifierThresholdDict[c] / 100 != 0.5) {
              this.drawUpdateRangesCurve()
            }
          }
        })
    },
  },
});
</script>
 