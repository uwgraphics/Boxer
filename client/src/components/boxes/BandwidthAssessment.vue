<template>
  <div class="card">
    <v-expansion-panels
      v-model="panel"
    >
      <v-expansion-panel>
        <v-expansion-panel-header>
          <div class="handle" style="font-size: 20px;">
            <v-icon
                style="margin-right: 10px;"
                @click="onClose"
            >close</v-icon>
            <span>(Trinary) Bandwidth Assessment</span>
          </div>
        </v-expansion-panel-header>
        <v-expansion-panel-content>
            <v-radio-group v-model="evaluationSelection" label="Evaluation method">
            <v-radio label="accuracy" value="accuracy"></v-radio>
            <v-radio id="mcc" label="mcc" value="mcc"></v-radio>
            <v-radio label="f1" value="f1"></v-radio>
            <v-radio label="precision" value="precision"></v-radio>
            <v-radio  label="recall" value="recall"></v-radio>
          </v-radio-group>
          </v-expansion-panel-content>
      </v-expansion-panel>
    </v-expansion-panels>
    <multiselect v-model="value" :options="options" 
      :multiple="true" 
      :close-on-select="false" 
      :clear-on-select="false" 
      :preserve-search="true" 
      placeholder="Pick sets" label="name" track-by="name" 
      :preselect-first="true">
      <template slot="selection" slot-scope="{ values, isOpen }">
        <span class="multiselect__single" v-if="values.length &amp;&amp; !isOpen">
          {{ values.length }} 
          options selected
        </span>
      </template>
    </multiselect>
    <div  ref="svg" />
  </div>
</template>

<script lang="ts">
import Vue from 'vue';
import * as d3 from 'd3';

import {
  BoxProps,
  Instance,
  SelectionRecord,
} from '../../types';
import {
  instanceById,
  intersection,
  union,
} from '../../utils';
import { PredicateSimple, Rule } from '../constraints/types';
import { blankConstraint } from '../constraints/utils';
import { range } from 'd3';

export default Vue.extend({
  name: 'Trinary_Bandwidth_Assessment',
  props: {
    boxProps: {
      type: Object as () => BoxProps,
      required: true,
    },
    onClose: {
      type: Function,
      required: true,
    },
  },
  data() {
    const margin = {top: 150, right: 20, bottom: 90, left: 120};
    const width = 1000 - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom;
    const hover = {
      type: '' as 'right' | 'wrong' | '',
      classifier: '',
      selectedClassifier: '',
    };
    const click = {
      classifier: '',
      threshold: ''
    };  
    const evaluationSelection = 'accuracy' as 'mcc'| 'f1' | 'precision'| 'recall'| 'accuracy'

    const thresholdRangeChange = {
      type: '' as 'right' | 'left' | '',
      classifier:'',
      threshold: 0.5,
      value: 0,
      left_diff:0.05,
      right_diff:0.05,
    }
    const bandwidthHover = {
      bandwidth: '',
    }
    const barHover  = {
      threshold: '',
    }
    const accHover  = {
      threshold: '',
    }
    const curveClassifier = [...this.boxProps.classifiers][3];
    const thresholds = ["0.00", "0.10","0.20","0.30","0.40","0.50","0.60","0.70","0.80","0.90","1.00"]
    const upperColors = ["rgb(37,102,118)", "rgb(138,225,249)"]
    const lowerColors = ["rgb(181,29,73)", "rgb(251,137,155)"]
    const middleColors = ["rgb(64,57,150)","rgb(119,136,153)"]
    const currentSetbandwidth = {
      left: 0.05,
      right: 0.05,
    };
    const currentBandwidth = {
      left: 0.05,
      right: 0.05,
    };
    const currentRemovedbandwidth = '';
    const withinClassifierBandwidths = [currentSetbandwidth];
    return {
      currentRemovedbandwidth,
      barHover,
      evaluationSelection,
      accHover,
      bandwidthHover,
      leftThreshold: 0.00,
      rightThreshold: 1.00,
      streamData: {},
      currentBandwidth,
      currentSetbandwidth,
      withinClassifierBandwidths,
      value: [],
      height,
      click,
      hover,
      thresholdRangeChange,
      margin,
      panel: [],
      rightColor: '#d1e5f0',
      rightHoverColor: '#4393c3',
      selection1Color: '#18FFFF',
      selection2Color: '#FF4081',
      width,
      wrongColor: '#fddbc7',
      wrongHoverColor: '#d6604d',
      classNumber:[...this.boxProps.classes].length,
      curveClassifier,
      numberOfBins: 11,
      thresholds,
      thresholdRangeRecords:{},
      upperColors,
      middleColors,
      lowerColors,
    };
  },
  computed: {
    addedBandWidthClassifiers() {
      return this.$store.state.addedBandWidthClassifiers;
    },
    confidenceIndex() : {} {
      let confidenceIndex  = {}
      for (let i in this.thresholds) {
        confidenceIndex[this.thresholds[i]] = parseInt(i)
      }
      return confidenceIndex
    },
    options(): any[] {
      let options = []
      const classifiers = this.classifiers
      classifiers.forEach((c)=>{
        options.push({name: c});
      })
      return options
    },
    classifierThresholds():{} {
      return this.$store.state.classifierThresholdDict;
    },
    classifierBandWidthDict(): string[] {
      return this.boxProps.classifierBandWidthDict;
    },
    classes(): string[] {
      this.classNumber = [...this.boxProps.classes].length
      return [...this.boxProps.classes];
    },
    classifiers(): string[] {
      const allClassifiers = [...this.boxProps.classifiers];  
      const dummyClassifiers = [
        'Oracle',
        'Majority Classifier',
        'Random Classifier',
      ];
      return allClassifiers.filter((c) => !dummyClassifiers.includes(c));
    },
    thresholdClassifierNameList():string[] {
      return this.$store.state.thresholdClassifierNameList
    },
    features(): string[] {
      return [...this.boxProps.features];
    },
    instances(): string[] {
      return [...this.boxProps.instances];
    },
    predictionKeys(): string[] {
      const predictionKeys = this.classifiers.slice();
      return predictionKeys;
    },
    continuousPredictionKeys():string[]{
      if (this.$store.state.datasetType == "continuous") {
        var continuousPredictionKeys = []
        this.predictionKeys.forEach((c)=>{
          continuousPredictionKeys.push(c+"_"+this.$store.state.classifierThresholdDict[c]/100)
        })
        return continuousPredictionKeys
      } else {
        return this.predictionKeys;
      }
    },
    continuousClassifierName():{} {
      var continuousClassifierName = {}
      this.classifiers.forEach((c)=>{
        if (this.$store.state.datasetType == "continuous") {
          continuousClassifierName[c] = c + "_" + this.$store.state.classifierThresholdDict[c]/100
        } else {
          continuousClassifierName[c] = c;
        }
      })
      return continuousClassifierName;
    },
    thresholdRange(): {
      [classifier: string]: {
        name: String,
        threshold: Number,
        left_range: Number,
        right_range: Number,
      },
    }{
      const thresholdRange: {
        [classifier: string]: {
          name: String,
          threshold: Number,
          left_range: Number,
          right_range: Number,
        },
      } = {};
      this.classifiers.forEach((c) => {
        let cur_acc = 0
        thresholdRange[this.continuousClassifierName[c]] = {
          name:c,
          threshold: Object.keys( this.classifierThresholds).includes(c)? this.classifierThresholds[c] : 0,
          left_range:  Object.keys( this.classifierThresholds).includes(c)? this.classifierThresholds[c] / 100 - 0.05 : 0,
          right_range:  Object.keys( this.classifierThresholds).includes(c)? this.classifierThresholds[c] / 100 + 0.05: 0,
        };
      });
      return thresholdRange
    },
    accumulations(): {
      [classifier: string]: {
        name: String,
        threshold: Number,
        acc: Number,
        ci_tp: Number[],
        ci_fn: Number[],
        ci_tn: Number[],
        ci_fp: Number[],
        ci_m: Number[],
        ci_m_y: Number[],
        ci_m_n: Number[],
        ci_tp_instances: {
          [threshold: string]:{
            instances: Set<String>,
          }
        },
        ci_fn_instances: {
          [threshold: string]:{
            instances: Set<String>,
            }
          },
          ci_fp_instances: {
          [threshold: string]:{
            instances: Set<String>,
          }
        },
        ci_tn_instances: {
          [threshold: string]:{
            instances: Set<String>,
            }
          },
        middle_instances: {
          [threshold: string]:{
            instances: Set<String>,
            }
          }, 
        middle_y_instances: {
          [threshold: string]:{
            instances: Set<String>,
            }
          },  
        middle_n_instances: {
          [threshold: string]:{
            instances: Set<String>,
            }
          },   
        continuous_pred: {
          [threshold: string]:{
            instances: Set<number>,
            }
          },  
      },
    }{
      const accumulations: {
        [classifier: string]: {
          name: String,
          threshold: Number,
          acc: Number,
          ci_tp: Number[],
          ci_fn: Number[],
          ci_tn: Number[],
          ci_fp: Number[],
          ci_m: Number[],
          ci_m_y: Number[],
          ci_m_n: Number[],
          ci_tp_instances: {
          [threshold: string]:{
            instances: Set<String>,
            }
          },
          ci_fp_instances: {
          [threshold: string]:{
            instances: Set<String>,
            }
          },
          ci_tn_instances: {
          [threshold: string]:{
            instances: Set<String>,
            }
          },
          ci_fn_instances: {
          [threshold: string]:{
            instances: Set<String>,
            }
          },
          middle_instances: {
          [threshold: string]:{
            instances: Set<String>,
            }
          },
          middle_y_instances: {
          [threshold: string]:{
            instances: Set<String>,
            }
          },  
          middle_n_instances: {
          [threshold: string]:{
            instances: Set<String>,
            }
          }, 
          continuous_pred:  {
          [threshold: string]:{
            instances: Set<number>,
            }
          },
        },
      } = {};


      var allIntervals = [];
      this.classifiers.forEach((c) => {
        let cur_acc = 0
        accumulations[c] = {
          name:c,
          threshold: Object.keys( this.classifierThresholds).includes(c)? this.classifierThresholds[c] : 0,
          acc: 0,
          ci_tp: [],
          ci_fn: [],
          ci_tn: [],
          ci_fp: [],
          ci_m: [],
          ci_m_y : [],
          ci_m_n : [],
          ci_tp_instances: {},
          ci_fp_instances: {},
          ci_tn_instances: {},
          ci_fn_instances: {},
          middle_instances: {},
          middle_y_instances: {},
          middle_n_instances: {},
          continuous_pred: {}
        };
        this.thresholds.forEach((t)=>{
          accumulations[c]["ci_tp_instances"][t] = {
            instances: new Set(),
          }
          accumulations[c]["ci_tn_instances"][t] = {
            instances: new Set(),
          }
          accumulations[c]["ci_fp_instances"][t] = {
            instances: new Set(),
          }
          accumulations[c]["ci_fn_instances"][t] = {
            instances: new Set(),
          }
          accumulations[c]["middle_instances"][t] = {
            instances: new Set(),
          }
          accumulations[c]["middle_y_instances"][t] = {
            instances: new Set(),
          }
          accumulations[c]["middle_n_instances"][t] = {
            instances: new Set(),
          }
          accumulations[c]["continuous_pred"][t] = {
            instances: new Set(),
          }
        })

        this.thresholds.forEach((t)=>{
          let left_edge = (parseFloat (t) - this.currentSetbandwidth.left) < 0 ? 0 : parseFloat (t) + (parseFloat (t) - this.currentSetbandwidth.left);//this.thresholdRange[this.continuousClassifierName[c]].left_range//parseFloat (t) + left_shift < 0 ? 0 : parseFloat (t) + left_shift;
          let right_edge = (parseFloat (t) - this.currentSetbandwidth.right) > 1 ? 1 : parseFloat (t) + (parseFloat (t) + this.currentSetbandwidth.right);//this.thresholdRange[this.continuousClassifierName[c]].right_range// parseFloat (t) + right_shift > 1 ? 1 : parseFloat (t) + right_shift;
          this.instances.forEach((id)=>{
            let continuous_value = (instanceById(id).continuous_predictions[c])
            let cur_pred = continuous_value <= t ? this.classes[0] : this.classes[1];
            let correct = instanceById(id).actual == cur_pred? 1 : 0;
            let interval = t;
            if (continuous_value > left_edge && continuous_value < right_edge) {
                accumulations[c]["middle_instances"][t].instances.add(id)
                accumulations[c].continuous_pred[t].instances.add(parseFloat(continuous_value))
                if (correct == 1) {
                  accumulations[c]["middle_y_instances"][t].instances.add(id)
                } else {
                  accumulations[c]["middle_n_instances"][t].instances.add(id)
                }
            } else if (continuous_value >= right_edge){
              if (instanceById(id).actual == this.classes[1]){
                accumulations[c]["ci_tp_instances"][interval].instances.add(id)
              } else {
                accumulations[c]["ci_fp_instances"][interval].instances.add(id)
              }
            } else{
              if (instanceById(id).actual == this.classes[0]) {
                accumulations[c]["ci_tn_instances"][interval].instances.add(id)
              } else {
                accumulations[c]["ci_fn_instances"][interval].instances.add(id)
              }
            }
          })
        })
        this.thresholds.forEach((t)=>{
          accumulations[c]["ci_tp"].push(accumulations[c]["ci_tp_instances"][t].instances.size)
          accumulations[c]["ci_tn"].push(accumulations[c]["ci_tn_instances"][t].instances.size)
          accumulations[c]["ci_fp"].push(accumulations[c]["ci_fp_instances"][t].instances.size)
          accumulations[c]["ci_fn"].push(accumulations[c]["ci_fn_instances"][t].instances.size)
          accumulations[c]["ci_m"].push(accumulations[c]["middle_instances"][t].instances.size)
          accumulations[c]["ci_m_y"].push(accumulations[c]["middle_y_instances"][t].instances.size)
          accumulations[c]["ci_m_n"].push(accumulations[c]["middle_n_instances"][t].instances.size)
          allIntervals.push(accumulations[c]["ci_tn_instances"][t].instances.size + accumulations[c]["ci_tp_instances"][t].instances.size + accumulations[c]["ci_fn_instances"][t].instances.size + accumulations[c]["ci_fp_instances"][t].instances.size)
        })
      });
      return accumulations;
    },
    
    selections(): {
      first: SelectionRecord | null,
      second: SelectionRecord | null,
    } {
      return this.$store.state.overlapSelections;
    },
    yThreshold(): d3.ScaleLinear<number, number> {
      const y = d3.scaleLinear()
        .domain([this.evaluationSelection == 'mcc'? -1: 0, 1])
        .range([this.height, 0]);
      return y;
    },
    x(): d3.ScaleBand<string> {
      const x = d3.scaleBand<string>()
        .domain(this.continuousPredictionKeys)
        .range([0, this.width*0.8])
        .paddingOuter(1)
        .paddingInner(0.3);
      return x;
    },
    y(): d3.ScaleLinear<number, number> {
      const y = d3.scaleLinear()
        .domain([0, 1])
        .range([this.height, 0]);
      return y;
    },
    xScale(): d3.ScaleLinear<number, number> {
      const xScale = d3.scaleLinear()
          .domain([0, 200])
          .range([0, 200])
          .clamp(true);
      return xScale;      
    },
    saveStatus() {
      return this.$store.state.saveStatus;
    },
    resumeStatus() {
      return this.$store.state.resumeStatus
    },
  },
  watch: {
    resumeStatus() {
      let viewsConfig = this.$store.state.viewsConfig;
      viewsConfig.forEach((view)=>{
        if (view.name == 'Trinary_Bandwidth_Assessment') {
          if (view.config) {
            let value  = view.config;
            this.value = []
            value.classifiers.forEach((c)=>{
              if (this.classifiers.includes(c)) {
                this.value.push({'name':c})
              }
            })
            this.evaluationSelection = value.evaluation
          }
        }
      })
      this.drawWithinInitial();
    },
    saveStatus() {
      let config = {"name":"Trinary_Bandwidth_Assessment", 
                    "config": {
                      "classifiers":this.value.map((c)=>c.name),
                      "evaluation":this.evaluationSelection}}
      this.$store.dispatch("changedSaveConfig",config)
    },
    click() {
      this.updateThreshold();
    },
    barHover() {
      this.drawBarHover();
    },
    accHover() {
      this.drawAccHover();
    },
    bandwidthHover() {
      this.drawBandwidthHover();
    },
    rightThreshold() {
      this.updateThresholdBound();
    },
    leftThreshold() {
      this.updateThresholdBound();
    },
    currentSetbandwidth() {
      this.withinClassifierBandwidths.push({'left':this.currentSetbandwidth.left, 'right': this.currentSetbandwidth.right});
    },
    currentBandwidth() {
      this.updateTmpChartData();
      this.drawStreamChart();
    },
    currentRemovedbandwidth() {
      let tmpwithinClassifierBandwidths = []
      this.withinClassifierBandwidths.forEach((c)=>{
        if (c.left == this.currentRemovedbandwidth.left && c.right == this.currentRemovedbandwidth.right) {

        } else {
          tmpwithinClassifierBandwidths.push(c)
        }
      })
      this.withinClassifierBandwidths = tmpwithinClassifierBandwidths;
    },
    withinClassifierBandwidths() {
      this.updateStreamChartData();
      this.drawStreamChart();
    },
    evaluationSelection() { 
      this.drawWithinInitial();
      this.drawStreamChart();
    },
    value() {
      if (this.value.length > 1) {
        this.value = [this.value[this.value.length-1]]
      }
      this.updateStreamChartData();
      this.drawStreamChart();
    },
    hover() { 
      this.drawHover();
    },
    thresholdRangeChange() {
      this.currentBandwidth = {
        'left':this.thresholdRangeChange.left_diff.toFixed(2),
        'right':this.thresholdRangeChange.right_diff.toFixed(2)
      }
      this.updateAdjusterBar();
    },
    numberOfBins() {
      this.updateThresholdBound();
      this.updatenumberOfBins();
    },
    instances() {
      this.drawWithinInitial();
      this.updateStreamChartData();
      this.drawStreamChart();
    },
    selections() {
      this.drawSelections();
    },
  },
  mounted() {
    let viewsConfig = this.$store.state.viewsConfig;
    viewsConfig.forEach((view)=>{
      if (view.name == 'Trinary_Bandwidth_Assessment') {
        if (view.config) {
          let value  = view.config;
          this.value = []
          value.classifiers.forEach((c)=>{
            if (this.classifiers.includes(c)) {
              this.value.push({'name':c})
            }
          })
          this.evaluationSelection = value.evaluation
        }
      }
    })
    this.drawWithinInitial();
  },
  methods: {
    updateThreshold() {
      const classifier = this.click.classifier;
      const value = parseFloat(this.click.threshold).toFixed(2);
      let changedClassifier = {"classifier":classifier, "single_threshold": parseFloat(value) * 100};
      this.$store.dispatch("changedCurveChosenClassifierThresholdTuple",changedClassifier)
    },
    clearBandwitdth() {
      this.withinClassifierBandwidths = [this.currentSetbandwidth];
    },
    addDefault() {
      this.withinClassifierBandwidths = [
        {left: 0.1,right: 0.1},
        {left: 0.05,right: 0.05},
        {left: 0.02,right: 0.02}];
    },
    clearHover() { 
      this.hover = ({type: '', classifier: '', selectedClassifier: ''});
    },
    clearBarHover() {
      this.barHover = ({threshold:''});
    },
    clearAccHover() {
      this.accHover = ({threshold:''});
    },
    clearThresholdBound() {
      this.leftThreshold = 0.00
      this.rightThreshold = 1.00
      this.numberOfBins = 11
      this.thresholds = [0.00, 0.10,0.20,0.30,0.40,0.50,0.60,0.70,0.80,0.90,1.00];
      this.updateStreamChartData();
      this.drawStreamChart();
    },
    updatenumberOfBins() {
      const chart = d3.select(this.$refs.svg);
      const svg_curve = chart.select(".svg-curve")

      const thresholdBin = chart.select('.slider-threshold-bin').attr('transform', 'translate(' + this.xScale((this.numberOfBins)*(200/20)) + ', -7.5)') 
      const thresholdBinText = chart.select('.bin-text').text("number of bins: " + this.numberOfBins)
    },
    updateThresholdBound() {
      var tmp_list = [];
      var tick = ((parseFloat(this.rightThreshold) - parseFloat(this.leftThreshold)) / parseFloat(this.numberOfBins));
      var num = parseFloat(this.leftThreshold)
      var count = 0
      var initializeFlag = 0

      for (var i in range (this.numberOfBins)) {
        count += 1
        if (num > this.rightThreshold) break;
        let cur_threshold = ""+num.toFixed(2)
        if (!tmp_list.includes(cur_threshold)) {
          tmp_list.push(cur_threshold);
        }
        num += tick;
      }

      this.thresholds = tmp_list;
      this.updateStreamChartData();
      this.drawStreamChart();
    },
    removeBandwidthHover() {
      const chart = d3.select(this.$refs.svg);
      this.thresholds.forEach((t,i)=>{
        this.withinClassifierBandwidths.forEach((bandwidth, c)=>{
          chart.select('.bar-threshold-band-'+c + '-' + i).attr("opacity","1")
          chart.select('.circle-threshold-band-'+c + '-' + i).attr("opacity","1")
          chart.select('.upline-band-'+c + '-' + i).attr("opacity","1")
          chart.select('.midline-band-'+c + '-' + i).attr("opacity","1")
          chart.select('.lowline-band-'+c + '-' + i).attr("opacity","1")
          chart.select('.line-band-'+c + '-' + i).attr("opacity","1")
        })
      })
    },
    drawBandwidthHover() {
      let bandwidth = this.bandwidthHover.bandwidth.split("-")[1];
      const chart = d3.select(this.$refs.svg);

      if (this.bandwidthHover.bandwidth == 'bandwidth-') {
        this.removeBandwidthHover()
      } else {
        this.thresholds.forEach((t,i)=>{
          this.withinClassifierBandwidths.forEach((bandwidth, c)=>{
            chart.select('.bar-threshold-band-'+c + '-' + i).attr("opacity","0.2")
            chart.select('.circle-threshold-band-'+c + '-' + i).attr("opacity","0.2")
            chart.select('.upline-band-'+c + '-' + i).attr("opacity","0.2")
            chart.select('.midline-band-'+c + '-' + i).attr("opacity","0.2")
            chart.select('.lowline-band-'+c + '-' + i).attr("opacity","0.2")
            chart.select('.line-band-'+c + '-' + i).attr("opacity","0.2")
          })
          chart.select('.bar-threshold-band-'+bandwidth + '-' + i).attr("opacity","1")
          chart.select('.circle-threshold-band-'+bandwidth + '-' + i).attr("opacity","1")
          chart.select('.upline-band-'+bandwidth + '-' + i).attr("opacity","1")
          chart.select('.midline-band-'+bandwidth + '-' + i).attr("opacity","1")
          chart.select('.lowline-band-'+bandwidth + '-' + i).attr("opacity","1")
          chart.select('.line-band-'+bandwidth + '-' + i).attr("opacity","1")
        })
      }
    },
    drawAccHover() {
      const chart = d3.select(this.$refs.svg);
      const threshold = this.accHover.threshold.split("-")[1];
      const streamData = this.streamData;
      let withinClassifierBandwidths = []
      this.withinClassifierBandwidths.forEach((i)=>{
        withinClassifierBandwidths.push(i)
      });
      const sortedBandWidth = withinClassifierBandwidths.sort((n1,n2) => {
          if ( (n1.right + n1.left) < (n2.right + n2.left)) {
              return 1;
          }

          if ( (n1.right + n1.left) > (n2.right + n2.left)) {
              return -1;
          }

          return 0;
      });


      if (this.accHover.threshold) {
        this.thresholds.forEach((t,i)=>{
          sortedBandWidth.forEach((bandwidth, c)=>{
            chart.select('.bar-threshold-band-'+c + '-' + i).attr("opacity","0.2")
            chart.select('.circle-threshold-band-'+c + '-' + i).attr("opacity","0.2")
            chart.select('.upline-band-'+c + '-' + i).attr("opacity","0.2")
            chart.select('.midline-band-'+c + '-' + i).attr("opacity","0.2")
            chart.select('.lowline-band-'+c + '-' + i).attr("opacity","0.2")
            chart.select('.line-band-'+c + '-' + i).attr("opacity","0.2")
          })
        })
        chart.select('.y-axis-marker-rect').attr('opacity', 1);  
        sortedBandWidth.forEach((bandwidth,c)=>{
          let i = threshold
          let tp = streamData[c].ci_tp[i]
          let fp = streamData[c].ci_fp[i]
          let tn = streamData[c].ci_tn[i]
          let fn = streamData[c].ci_fn[i]
          let m_y = streamData[c].ci_m_y[i]
          let m_n = streamData[c].ci_m_n[i]
          let m = streamData[c].ci_m[i]
          let precision = (tp+fp)!=0? (tp/(tp+fp)) : tp ==0?1:0
          let recall = (tp+fn)!=0? (tp/(tp+fn)) : tn ==0?1:0
          let f1 = (precision + recall) !=0? (2*precision*recall) / (precision + recall):precision*recall==0?1:0
          let mcc = 0
          if ((tp+fp)*(tp+fn)*(tn+fp)*(tn+fn) != 0) {
             mcc = ((tp*tn-fp*fn) / Math.sqrt((tp+fp)*(tp+fn)*(tn+fp)*(tn+fn)))
          } 
          chart.select('.bar-threshold-band-'+c + '-' + threshold).attr("opacity","1")
          chart.select('.circle-threshold-band-'+c + '-' + threshold).attr("opacity","1")
          chart.select('.upline-band-'+c + '-' + threshold).attr("opacity","1")
          chart.select('.midline-band-'+c + '-' + threshold).attr("opacity","1")
          chart.select('.lowline-band-'+c + '-' + threshold).attr("opacity","1")
          chart.select('.line-band-'+c + '-' + threshold).attr("opacity","1")
          chart.select('.y-axis-marker-text-1-'+c).text("acc+: "+ ((this.streamData[c].ci_tp[threshold] + this.streamData[c].ci_tn[threshold] +  this.streamData[c].ci_m[threshold])/(this.instances.length)).toFixed(2)).attr("opacity", this.evaluationSelection == 'accuracy'? 1:0);
          chart.select('.y-axis-marker-text-1-s1-'+c)
                  .text(this.evaluationSelection == 'accuracy'?"acc: "+ ((this.streamData[c].ci_tp[threshold] + this.streamData[c].ci_tn[threshold] )/(this.instances.length -  this.streamData[c].ci_m[threshold])).toFixed(2)
                        :this.evaluationSelection == 'precision'?"precision: "+ (precision).toFixed(2)
                        :this.evaluationSelection == 'recall'?"recall: "+ (recall).toFixed(2)
                        :this.evaluationSelection == 'mcc'?"mcc: "+ (mcc).toFixed(2)
                        :"f1: "+ (f1).toFixed(2)).attr("opacity", 1);
          chart.select('.y-axis-marker-text-1-s2-'+c).text("acc-: "+ ((this.streamData[c].ci_tp[threshold] + this.streamData[c].ci_tn[threshold] )/(this.instances.length)).toFixed(2)).attr("opacity", this.evaluationSelection == 'accuracy'? 1:0);
        })
      } else {
        chart.select('.y-axis-marker-rect').attr('opacity', 0);  

        this.thresholds.forEach((t,i)=>{
          sortedBandWidth.forEach((bandwidth, c)=>{
            chart.select('.bar-threshold-band-'+c + '-' + i).attr("opacity","1")
            chart.select('.circle-threshold-band-'+c + '-' + i).attr("opacity","1")
            chart.select('.upline-band-'+c + '-' + i).attr("opacity","1")
            chart.select('.midline-band-'+c + '-' + i).attr("opacity","1")
            chart.select('.lowline-band-'+c + '-' + i).attr("opacity","1")
            chart.select('.line-band-'+c + '-' + i).attr("opacity","1")
            chart.select('.y-axis-marker-text-1-'+c).text(c).attr("opacity", 0);
            chart.select('.y-axis-marker-text-1-s1-'+c).text(c).attr("opacity", 0);
            chart.select('.y-axis-marker-text-1-s2-'+c).text(c).attr("opacity", 0);
          })
        })
      }

    },
    drawBarHover() {
      const threshold = this.barHover.threshold.split("-")[1];
      const curveText = (bandwidth:number, threshold:number,  selection: Set<string>) => {

        const instances = this.streamData[bandwidth]["middle_instances"][this.thresholds[threshold]].instances
        const overlappingInstances = intersection(instances, selection);
        var totalInstances = 0 
        totalInstances = this.instances.length
        const fractionOfTotalInstances = overlappingInstances.size / totalInstances;
        return (fractionOfTotalInstances).toFixed(2);
      };
      
      const {first, second} = this.selections;
      let withinClassifierBandwidths = []
      this.withinClassifierBandwidths.forEach((i)=>{
        withinClassifierBandwidths.push(i)
      });
      const sortedBandWidth = withinClassifierBandwidths.sort((n1,n2) => {
          if ( (n1.right + n1.left) < (n2.right + n2.left)) {
              return 1;
          }

          if ( (n1.right + n1.left) > (n2.right + n2.left)) {
              return -1;
          }

          return 0;
      });
      const chart = d3.select(this.$refs.svg);
      const streamData = this.streamData;
      

      if (this.barHover.threshold) {
        this.thresholds.forEach((t,i)=>{
          sortedBandWidth.forEach((bandwidth, c)=>{
            chart.select('.bar-threshold-band-'+c + '-' + i).attr("opacity","0.2")
            chart.select('.bar-hover-box-1-'+c + '-' + i).attr("opacity",  "0")
            chart.select('.bar-hover-box-2-'+c + '-' + i).attr("opacity",  "0")
            chart.select('.bar-hover-text-1-'+c + '-' + i).attr("opacity",  "0")
            chart.select('.bar-hover-text-2-'+c + '-' + i).attr("opacity",  "0")
            chart.select('.circle-threshold-band-'+c + '-' + i).attr("opacity","0.2")
            chart.select('.upline-band-'+c + '-' + i).attr("opacity","0.2")
            chart.select('.midline-band-'+c + '-' + i).attr("opacity","0.2")
            chart.select('.lowline-band-'+c + '-' + i).attr("opacity","0.2")
            chart.select('.line-band-'+c + '-' + i).attr("opacity","0.2")
          })
        })
        chart.select('.y-axis-marker-rect').attr('opacity', 1);  
        sortedBandWidth.forEach((bandwidth,c)=>{
          chart.select('.bar-threshold-band-'+c + '-' + threshold).attr("opacity","1")
          chart.select('.bar-hover-box-1-'+c + '-' + threshold).attr("opacity",  "1")
          chart.select('.bar-hover-box-2-'+c + '-' + threshold).attr("opacity",  "1")
          chart.select('.bar-hover-text-1-'+c + '-' + threshold).attr("opacity",  "1")
          chart.select('.bar-hover-text-2-'+c + '-' + threshold).attr("opacity",  "1")
          chart.select('.circle-threshold-band-'+c + '-' + threshold).attr("opacity","1")
          chart.select('.upline-band-'+c + '-' + threshold).attr("opacity","1")
          chart.select('.midline-band-'+c + '-' + threshold).attr("opacity","1")
          chart.select('.lowline-band-'+c + '-' + threshold).attr("opacity","1")
          chart.select('.line-band-'+c + '-' + threshold).attr("opacity","1")
          chart.select('.y-axis-marker-text-1-'+c).text("uncertain: "+ (this.streamData[c].ci_m[threshold] / this.instances.length).toFixed(2)).attr("opacity", 1);
          if (first) {
            chart.select('.y-axis-marker-text-1-s1-'+c).text("select1: "+ curveText(c,threshold,first.instances)).attr("opacity", 1);
          } else {
            chart.select('.y-axis-marker-text-1-s1-'+c).attr("opacity", 0);
          }
          if (second) {
            chart.select('.y-axis-marker-text-1-s2-'+c).text("select2: "+ curveText(c,threshold,second.instances)).attr("opacity", 1);
          } else {
            chart.select('.y-axis-marker-text-1-s2-'+c).attr("opacity", 0);
          }
          
        })
      } else {
        chart.select('.y-axis-marker-rect').attr('opacity', 0);  

        this.thresholds.forEach((t,i)=>{
          sortedBandWidth.forEach((bandwidth, c)=>{
            chart.select('.bar-threshold-band-'+c + '-' + i).attr("opacity","1")
            chart.select('.bar-hover-box-1-'+c + '-' + i).attr("opacity",  "0")
            chart.select('.bar-hover-box-2-'+c + '-' + i).attr("opacity",  "0")
            chart.select('.bar-hover-text-1-'+c + '-' + i).attr("opacity",  "0")
            chart.select('.bar-hover-text-2-'+c + '-' + i).attr("opacity",  "0")
            chart.select('.circle-threshold-band-'+c + '-' + i).attr("opacity","1")
            chart.select('.upline-band-'+c + '-' + i).attr("opacity","1")
            chart.select('.midline-band-'+c + '-' + i).attr("opacity","1")
            chart.select('.lowline-band-'+c + '-' + i).attr("opacity","1")
            chart.select('.line-band-'+c + '-' + i).attr("opacity","1")
            chart.select('.y-axis-marker-text-1-'+c).text(c).attr("opacity", 0);
            chart.select('.y-axis-marker-text-1-s1-'+c).text(c).attr("opacity", 0);
            chart.select('.y-axis-marker-text-1-s2-'+c).text(c).attr("opacity", 0);
          })
        })
      }
    },  
    drawHover() {
      // @ts-ignore
      const chart = d3.select(this.$refs.svg);
      const hoverClassifier = this.hover.selectedClassifier
      const curveBars = chart.selectAll('.bar-threshold-right-'+hoverClassifier)
      const yAxisMarkerLineCurveLow = chart.select('.y-axis-marker-line-curve-low');
      const yAxisMarkerLineCurveUp = chart.select('.y-axis-marker-line-curve-up');
      const yAxisMarkerLineCurveBar = chart.select('.y-axis-marker-line-curve-bar');
      const yAxisMarkerLineCurve = chart.select('.y-axis-marker-line-curve');
      const yAxisMarkerTextCurveBar = chart.select('.y-axis-marker-text-curve-bar');
      const yAxisMarkerTextCurve = chart.select('.y-axis-marker-text-curve');
      const yAxisMarkerTextCurveLow = chart.select('.y-axis-marker-text-curve-low');
      const yAxisMarkerTextCurveUp = chart.select('.y-axis-marker-text-curve-up');
      const yAxisMarkerTextClassifier = chart.select('.y-axis-marker-text-classifier');
      const yAxisMarkerTextS1 = chart.select('.y-axis-marker-text-s1')
      const yAxisMarkerTextS2 = chart.select('.y-axis-marker-text-s2')

      const yAxisMarkerRect = chart.select('.y-axis-marker-rect');

      const allSelectedClassifier = this.value.map((c)=>c.name)
      const { first, second } = this.selections;

      const xThreshold = d3.scaleBand<string>()
        .domain(this.thresholds)
        .range([0, this.width*0.8])
        .paddingOuter(0.2);

      const curveText = (classifierName:string, typeString, selection: Set<string>) => {
        const instances = this.accumulations[classifierName].middle_instances[typeString].instances
        var totalInstances = 0 
        totalInstances = this.instances.length
        const overlappingInstances = intersection(instances, selection);
        const fractionOfTotalInstances = overlappingInstances.size / totalInstances * 100;
        return fractionOfTotalInstances.toFixed(2) + "%" ;
      };


      allSelectedClassifier.forEach((c)=>{
        chart.selectAll('.bar-threshold-right-'+c).attr('fill', "lightgrey");
      })
    
      if (this.hover.type === 'curve-bar') {
        curveBars.data(this.thresholds)
          .attr('fill', (d,i) =>
            i === this.hover.classifier
              ? "grey"
              : "lightgrey");
      } else {
        curveBars.attr('fill', "lightgrey");
      }
      
      const moveDuration = 500;
      const disappearDuration = 1000;
      if (this.hover.type) {
        yAxisMarkerRect.transition()
          .duration(moveDuration)
          .attr('opacity', 1)
          .attr("fill","white")
          .attr('transform', `translate(
            ${xThreshold(this.thresholds[this.hover.classifier])},
            ${-150})`)

        yAxisMarkerTextClassifier
          .transition()
          .duration(moveDuration)
          .attr('fill-opacity', 1)
          .attr('transform', `translate(
            ${xThreshold(this.thresholds[this.hover.classifier])+80},
            ${-130})`)          
          .text('classifier: ' + hoverClassifier);

        yAxisMarkerLineCurveBar
          .transition()
          .duration(moveDuration)
          .attr('stroke-opacity', 1)
          .attr('y1',  this.y((this.accumulations[hoverClassifier].ci_m[this.hover.classifier]) / (this.instances.length)))
          .attr('x2', this.width)
          .attr('y2', this.y((this.accumulations[hoverClassifier].ci_m[this.hover.classifier]) / (this.instances.length)));
        yAxisMarkerTextCurveBar
          .transition()
          .duration(moveDuration)
          .attr('fill-opacity', 1)
          .attr('transform', `translate(
            ${xThreshold(this.thresholds[this.hover.classifier])+80},
            ${-110})`)          
          .text('Fraction: ' +`${((this.accumulations[hoverClassifier].ci_m[this.hover.classifier]) / (this.instances.length) * 100).toFixed(1)}%`);

        yAxisMarkerLineCurve
            .transition()
            .duration(moveDuration)
            .attr('stroke-opacity', 1)
            .attr('y1',  this.y((this.accumulations[hoverClassifier].ci_tp[this.hover.classifier] + this.accumulations[hoverClassifier].ci_tn[this.hover.classifier]) / (this.instances.length - this.accumulations[hoverClassifier].ci_m[this.hover.classifier])))
            .attr('x2', this.width)
            .attr('y2', this.y((this.accumulations[hoverClassifier].ci_tp[this.hover.classifier] + this.accumulations[hoverClassifier].ci_tn[this.hover.classifier] ) / (this.instances.length - this.accumulations[hoverClassifier].ci_m[this.hover.classifier])));  

        yAxisMarkerTextCurve
          .transition()
          .duration(moveDuration)
          .attr('fill-opacity', 1)
          .attr('transform', `translate(
            ${xThreshold(this.thresholds[this.hover.classifier])+80},
            ${-70})`)            
          .text(this.evaluationSelection == 'accuracy'? "acc: "
          :this.evaluationSelection == 'precision'? "precision: "
          :this.evaluationSelection == 'recall'? "recall: "
          :this.evaluationSelection == 'mcc'? "mcc: "
          :"f1"+ `${((this.accumulations[hoverClassifier].ci_tp[this.hover.classifier] + this.accumulations[hoverClassifier].ci_tn[this.hover.classifier]) / (this.instances.length - this.accumulations[hoverClassifier].ci_m[this.hover.classifier]) * 100).toFixed(1)}%`);

        yAxisMarkerLineCurveLow
            .transition()
            .duration(moveDuration)
            .attr('stroke-opacity', 1)
            .attr('y1',  this.y((this.accumulations[hoverClassifier].ci_tp[this.hover.classifier] + this.accumulations[hoverClassifier].ci_tn[this.hover.classifier]) / (this.instances.length)))
            .attr('x2', this.width)
            .attr('y2', this.y((this.accumulations[hoverClassifier].ci_tp[this.hover.classifier] + this.accumulations[hoverClassifier].ci_tn[this.hover.classifier]) / (this.instances.length)))
                      .attr("visibility",this.evaluationSelection == 'accuracy'? "visible":"hidden")
 
        
        yAxisMarkerTextCurveLow
          .transition()
          .duration(moveDuration)
          .attr('fill-opacity', 1)
          .attr('transform', `translate(
            ${xThreshold(this.thresholds[this.hover.classifier])+80},
            ${-50})`)   
          .text('acc-: '+`${((this.accumulations[hoverClassifier].ci_tp[this.hover.classifier] + this.accumulations[hoverClassifier].ci_tn[this.hover.classifier]) / (this.instances.length) * 100).toFixed(1)}%`)
                    .attr("visibility",this.evaluationSelection == 'accuracy'? "visible":"hidden")



        yAxisMarkerLineCurveUp
            .transition()
            .duration(moveDuration)
            .attr('stroke-opacity', 1)
            .attr('y1',  this.y((this.accumulations[hoverClassifier].ci_tp[this.hover.classifier] + this.accumulations[hoverClassifier].ci_tn[this.hover.classifier] + this.accumulations[hoverClassifier].ci_m[this.hover.classifier]) / (this.instances.length)))
            .attr('x2', this.width)
            .attr('y2', this.y((this.accumulations[hoverClassifier].ci_tp[this.hover.classifier] + this.accumulations[hoverClassifier].ci_tn[this.hover.classifier] + this.accumulations[hoverClassifier].ci_m[this.hover.classifier]) / (this.instances.length)))
          .attr("visibility",this.evaluationSelection == 'accuracy'? "visible":"hidden")

        yAxisMarkerTextCurveUp
          .transition()
          .duration(moveDuration)
          .attr('fill-opacity', 1)
          .attr('transform', `translate(
            ${xThreshold(this.thresholds[this.hover.classifier])+80},
            ${-90})`)   
          .text('acc+: '+`${((this.accumulations[hoverClassifier].ci_tp[this.hover.classifier] + this.accumulations[hoverClassifier].ci_tn[this.hover.classifier] + this.accumulations[hoverClassifier].ci_m[this.hover.classifier]) / (this.instances.length) * 100).toFixed(1)}%`)
          .attr("visibility",this.evaluationSelection == 'accuracy'? "visible":"hidden")

        if (first) {
          yAxisMarkerTextS1
          .transition()
          .duration(moveDuration)
          .attr('fill-opacity', 1)
          .attr('transform', `translate(
            ${xThreshold(this.thresholds[this.hover.classifier])+80},
            ${-20})`)   
          .text("1st: "+ curveText(this.hover.selectedClassifier, this.thresholds [this.hover.classifier], first.instances))
        }
        if (second) {
          yAxisMarkerTextS2
            .transition()
            .duration(moveDuration)
            .attr('fill-opacity', 1)
            .attr('transform', `translate(
              ${xThreshold(this.thresholds[this.hover.classifier])+80},
              ${-0})`)   
            .text("2nd: "+ curveText(this.hover.selectedClassifier, this.thresholds [this.hover.classifier], second.instances))
        }

      } else {
        yAxisMarkerTextClassifier
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);    
        yAxisMarkerTextS1
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
          // .attr('opacity', 0); 
        yAxisMarkerTextS2
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
          // .attr('opacity', 0); 
        yAxisMarkerRect.transition()
          .duration(disappearDuration)
          .attr('opacity', 0)
        yAxisMarkerLineCurveBar
          .transition()
          .duration(disappearDuration)
          .attr('stroke-opacity', 0);
        yAxisMarkerLineCurve
          .transition()
          .duration(disappearDuration)
          .attr('stroke-opacity', 0);  
        yAxisMarkerLineCurveUp
          .transition()
          .duration(disappearDuration)
          .attr('stroke-opacity', 0);  
        yAxisMarkerLineCurveLow
          .transition()
          .duration(disappearDuration)
          .attr('stroke-opacity', 0);    
        yAxisMarkerTextCurveBar
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
        yAxisMarkerTextCurve
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);  
        yAxisMarkerTextCurveLow
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);  
        yAxisMarkerTextCurveUp
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);      
      }
    },
    updateAdjusterBar() {
      const threshold =  this.thresholdRangeChange.threshold;
      const curClassifier = this.value.length == 0? '' : this.value[this.value.length - 1].name;
      const type = this.thresholdRangeChange.type;
      const value = this.thresholdRangeChange.type == '' ? 0.05 : (parseFloat(this.thresholdRangeChange.value)-100) / 100 * 0.1;
      const chart = d3.select(this.$refs.svg);
      const sliderHead = d3.select(".slider-circle-time-"+type)
      const sliderText = d3.select(".range-text-"+type)
      const legendText1 = chart.select(".legend-text1")
      const legendText2 = chart.select(".legend-text2") 
      const legendLine2 = chart.select(".legend_line2") 

      if (type == 'left'){
        d3.select(".slider-circle-time-"+"left").attr('transform', 'translate(' + (100 - 100 * (this.thresholdRangeChange.left_diff)/0.1) + ', -140)')
        d3.select(".range-text-"+"left").text("("+ (- this.thresholdRangeChange.left_diff).toFixed(2) +",")
      }
      else  {
        d3.select(".slider-circle-time-"+"right").attr('transform', 'translate(' + (100 + 100 * (this.thresholdRangeChange.right_diff)/0.1) + ', -140)')
        d3.select(".range-text-"+"right").text(( this.thresholdRangeChange.right_diff).toFixed(2)+")") 
      }
    },
    updateTmpChartData() {
      let streamData = {};
      let c = 0
      let bandwidth  = this.currentBandwidth
      const curClassifier = this.value.length == 0? '' : this.value[this.value.length - 1].name;


      const sequentialScale = d3.scaleSequential<string>( d3.interpolatePuBuGn)
            .domain([0, (this.withinClassifierBandwidths.length + 1)*2])
            .interpolator(function (x) { 
              return d3.interpolatePuBuGn(x);} );


      let count = 0
      for (let key in this.streamData) {
        if (count >= this.withinClassifierBandwidths.length) {
          break
        }
        count += 1
        streamData[key] = this.streamData[key]
        streamData[key].color = sequentialScale(c+1),
        c += 1
      }

      streamData[c] =  {
        left: bandwidth.left,
        right: bandwidth.right,
        threshold: this.thresholds[c],
        threshold_idx: c,
        color: sequentialScale(c+1),
        ci_tp: [],
        ci_fn: [],
        ci_tn: [],
        ci_fp: [],
        ci_m: [],
        ci_m_y : [],
        ci_m_n : [],
        ci_tp_instances: {},
        ci_fp_instances: {},
        ci_tn_instances: {},
        ci_fn_instances: {},
        middle_instances: {},
        middle_y_instances: {},
        middle_n_instances: {},
      }

      this.thresholds.forEach((t)=>{
          streamData[c]["ci_tp_instances"][t] = {
          instances: new Set(),
        }
        streamData[c]["ci_tn_instances"][t] = {
          instances: new Set(),
        }
        streamData[c]["ci_fp_instances"][t] = {
          instances: new Set(),
        }
        streamData[c]["ci_fn_instances"][t] = {
          instances: new Set(),
        }
        streamData[c]["middle_instances"][t] = {
          instances: new Set(),
        }
        streamData[c]["middle_y_instances"][t] = {
          instances: new Set(),
        }
        streamData[c]["middle_n_instances"][t] = {
          instances: new Set(),
        }
      })

      this.thresholds.forEach((t)=>{
        let left_edge = (parseFloat(t) - parseFloat (bandwidth.left)) < 0 ? 0 : (parseFloat(t) - parseFloat (bandwidth.left));
        let right_edge = (parseFloat(t) + parseFloat (bandwidth.right)) > 1 ? 1 : (parseFloat(t) + parseFloat (bandwidth.right)) ;

        this.instances.forEach((id)=>{
          let continuous_value = (instanceById(id).continuous_predictions[curClassifier])
          let cur_pred = continuous_value <= parseFloat (t) ? this.classes[0] : this.classes[1];
          let correct = instanceById(id).actual == cur_pred? 1 : 0;
          let interval = t;
          if (continuous_value > left_edge && continuous_value < right_edge) {
              streamData[c]["middle_instances"][t].instances.add(id)
              if (correct == 1) {
                streamData[c]["middle_y_instances"][t].instances.add(id)
              } else {
                streamData[c]["middle_n_instances"][t].instances.add(id)
              }
          } else if (continuous_value >= right_edge){
            if (instanceById(id).actual == this.classes[1]){
              streamData[c]["ci_tp_instances"][interval].instances.add(id)
            } else {
              streamData[c]["ci_fp_instances"][interval].instances.add(id)
            }
          } else{
            if (instanceById(id).actual == this.classes[0]) {
              streamData[c]["ci_tn_instances"][interval].instances.add(id)
            } else {
              streamData[c]["ci_fn_instances"][interval].instances.add(id)
            }
          }
        })
      })
      this.thresholds.forEach((t)=>{
        streamData[c]["ci_tp"].push(streamData[c]["ci_tp_instances"][t].instances.size)
        streamData[c]["ci_tn"].push(streamData[c]["ci_tn_instances"][t].instances.size)
        streamData[c]["ci_fp"].push(streamData[c]["ci_fp_instances"][t].instances.size)
        streamData[c]["ci_fn"].push(streamData[c]["ci_fn_instances"][t].instances.size)
        streamData[c]["ci_m"].push(streamData[c]["middle_instances"][t].instances.size)
        streamData[c]["ci_m_y"].push(streamData[c]["middle_y_instances"][t].instances.size)
        streamData[c]["ci_m_n"].push(streamData[c]["middle_n_instances"][t].instances.size)
      })
    

      this.streamData  = streamData
    },
    updateStreamChartData() {
      const curClassifier = this.value.length == 0? '' : this.value[this.value.length - 1].name;
      const sequentialScale = d3.scaleSequential<string>( d3.interpolatePuBuGn)
            .domain([0, this.withinClassifierBandwidths.length*2])
            .interpolator(function (x) { 
              return d3.interpolatePuBuGn(x);} );
      let streamData = {};
      this.withinClassifierBandwidths.forEach((bandwidth, c) =>{
        streamData[c] =  {
          left: bandwidth.left,
          right: bandwidth.right,
          threshold: this.thresholds[c],
          threshold_idx: c,
          color: sequentialScale(c+1),
          ci_tp: [],
          ci_fn: [],
          ci_tn: [],
          ci_fp: [],
          ci_m: [],
          ci_m_y : [],
          ci_m_n : [],
          ci_tp_instances: {},
          ci_fp_instances: {},
          ci_tn_instances: {},
          ci_fn_instances: {},
          middle_instances: {},
          middle_y_instances: {},
          middle_n_instances: {},
        }
        this.thresholds.forEach((t)=>{
          streamData[c]["ci_tp_instances"][t] = {
            instances: new Set(),
          }
          streamData[c]["ci_tn_instances"][t] = {
            instances: new Set(),
          }
          streamData[c]["ci_fp_instances"][t] = {
            instances: new Set(),
          }
          streamData[c]["ci_fn_instances"][t] = {
            instances: new Set(),
          }
          streamData[c]["middle_instances"][t] = {
            instances: new Set(),
          }
          streamData[c]["middle_y_instances"][t] = {
            instances: new Set(),
          }
          streamData[c]["middle_n_instances"][t] = {
            instances: new Set(),
          }
        })
        this.thresholds.forEach((t)=>{
          // let left_edge = parseFloat(t) - parseFloat (bandwidth.left);
          // let right_edge = parseFloat(t) + parseFloat (bandwidth.right);
          let left_edge = (parseFloat(t) - parseFloat (bandwidth.left)) < 0 ? 0 : (parseFloat(t) - parseFloat (bandwidth.left));
          let right_edge = (parseFloat(t) + parseFloat (bandwidth.right)) > 1 ? 1 : (parseFloat(t) + parseFloat (bandwidth.right)) ;

          this.instances.forEach((id)=>{
            let continuous_value = (instanceById(id).continuous_predictions[curClassifier])
            let cur_pred = continuous_value <= parseFloat (t) ? this.classes[0] : this.classes[1];
            let correct = instanceById(id).actual == cur_pred? 1 : 0;
            // let continuous_value = (instanceById(id).continuous_predictions[curClassifier])
            // let cur_pred = continuous_value <= parseFloat (t) ? this.classes[0] : this.classes[1];
            // let correct = instanceById(id).actual == cur_pred? 1 : 0;
            let interval = t;
            if (continuous_value > left_edge && continuous_value < right_edge) {
                streamData[c]["middle_instances"][t].instances.add(id)
                // streamData[c].continuous_pred[t].instances.add(parseFloat(continuous_value))
                if (correct == 1) {
                  streamData[c]["middle_y_instances"][t].instances.add(id)
                } else {
                  streamData[c]["middle_n_instances"][t].instances.add(id)
                }
            } else if (continuous_value >= right_edge){
              if (instanceById(id).actual == this.classes[1]){
                streamData[c]["ci_tp_instances"][interval].instances.add(id)
              } else {
                streamData[c]["ci_fp_instances"][interval].instances.add(id)
              }
            } else{
              if (instanceById(id).actual == this.classes[0]) {
                streamData[c]["ci_tn_instances"][interval].instances.add(id)
              } else {
                streamData[c]["ci_fn_instances"][interval].instances.add(id)
              }
            }
            // if (continuous_value < right_edge && continuous_value > left_edge){
            //   streamData[c]["middle_instances"][t].instances.add(id)
            //   if (correct == 1) {
            //     streamData[c]["middle_y_instances"][t].instances.add(id)
            //   } else {
            //     streamData[c]["middle_n_instances"][t].instances.add(id)
            //   }
            // } else {
            //   let interval = t
            //   if (correct == 1){
            //     if (instanceById(id).actual == this.classes[1]){
            //       streamData[c]["ci_tp_instances"][interval].instances.add(id)
            //     } else {
            //       streamData[c]["ci_tn_instances"][interval].instances.add(id)
            //     }
            //   }
            //   else{
            //     if (instanceById(id).actual == this.classes[1]) {
            //       streamData[c]["ci_fp_instances"][interval].instances.add(id)
            //     } else {
            //       streamData[c]["ci_fn_instances"][interval].instances.add(id)
            //     }
            //   }
            // }
          })
        })
        this.thresholds.forEach((t)=>{
          streamData[c]["ci_tp"].push(streamData[c]["ci_tp_instances"][t].instances.size)
          streamData[c]["ci_tn"].push(streamData[c]["ci_tn_instances"][t].instances.size)
          streamData[c]["ci_fp"].push(streamData[c]["ci_fp_instances"][t].instances.size)
          streamData[c]["ci_fn"].push(streamData[c]["ci_fn_instances"][t].instances.size)
          streamData[c]["ci_m"].push(streamData[c]["middle_instances"][t].instances.size)
          streamData[c]["ci_m_y"].push(streamData[c]["middle_y_instances"][t].instances.size)
          streamData[c]["ci_m_n"].push(streamData[c]["middle_n_instances"][t].instances.size)
        })
      })
      this.streamData = streamData;
    },
    drawWithinInitial() {
      d3.select(this.$refs.svg).selectAll('*').remove();
      const c = this.value.map((v)=>v.name)[this.value.length - 1]
      const thresholds = this.thresholds;
      const instances = this.instances;
      const accumulations = this.accumulations;
      const x = this.x    
      const y = this.y;
      const xThreshold = d3.scaleBand<string>()
      .domain(this.thresholds)
      .range([0, this.width*0.8])
      .paddingOuter(0.2)
      .paddingInner(0.2);
      const yThreshold = this.yThreshold
      const barWidth = xThreshold.bandwidth();

      const svgAll = d3.select(this.$refs.svg).append('svg')
        .attr("class","initail_svg")
        .attr('width', '100%')
        .attr('viewBox', `0 0
          ${(this.width + this.margin.left + this.margin.right)}
          ${(this.height + this.margin.top + this.margin.bottom)*1.2}`)
      const svg = svgAll.append('g')
          .attr('transform', `translate(${0}, ${this.margin.top*1.2})`); 
      const svg_curves = svgAll.append('g')
          .attr("class","svg-curve")
          .attr('transform', `translate(${this.margin.left}, ${this.margin.top*1.2})`);  
      const evaluationKeys = this.evaluationSelection;


      const width = this.width / 6;
      const height = this.margin.top / 2;
      const legend2 = svg  
          .append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(
              ${(this.width - this.margin.left)},
              ${-height*2})`);

      const thresholdBins =  legend2.append("g")
              .attr("transform",  "translate("+(width * 2-200-40)+"," + 0 +")")

      const accLegend = legend2.append("g")
              .attr("transform",  "translate("+(width * 2-140)+"," + 40 +")")

      const drawLegend = () => {
        accLegend.append('line')
            .attr('class', 'acc1')
            .style("stroke", "grey")
            .style("stroke-opacity", "1")
            .style("stroke-width", "6")
            .attr('x1', 90)
            .attr('x2', 100)
            .attr('y1', 0)
            .attr('y2', 0)
          .attr("visibility",this.evaluationSelection == 'accuracy'? "visible":"hidden")

        accLegend.append('line')
            .attr('class', 'acc2')
            .style("stroke", "grey")
            .style("stroke-opacity", "1")
            .style("stroke-width", "6")
            .attr('x1', 90)
            .attr('x2', 100)
            .attr('y1', 20)
            .attr('y2', 20)
        accLegend.append('line')
            .attr('class', 'acc3')
            .style("stroke", "grey")
            .style("stroke-opacity", "1")
            .style("stroke-width", "6")
            .attr('x1', 90)
            .attr('x2', 100)
            .attr('y1', 40)
            .attr('y2', 40)
          .attr("visibility",this.evaluationSelection == 'accuracy'? "visible":"hidden")

        accLegend.append('line')
            .attr('class', 'acc3')
            .style("stroke", "grey")
            .style("stroke-opacity", "1")
            .style("stroke-width", "2")
            .attr('x1', 95)
            .attr('x2', 95)
            .attr('y1', 0)
            .attr('y2', 40)
          .attr("visibility",this.evaluationSelection == 'accuracy'? "visible":"hidden")

        accLegend.append('text')
          .attr("class","bin-text")
          .attr("transform",  "translate("+(-240)+"," +0 +")")
          .attr('font-size', '24px')
          .attr('text-anchor', 'left')
          .attr('alignment-baseline', 'middle')
          .attr("fill", 'steelblue')
          .text('acc+ (uncertainty as right)')   
          .attr("visibility",this.evaluationSelection == 'accuracy'? "visible":"hidden")

        accLegend.append('text')
          .attr("class","bin-text")
          .attr("transform",  "translate("+(-240)+"," +20 +")")
          .attr('font-size', '24px')
          .attr('text-anchor', 'left')
          .attr('alignment-baseline', 'middle')
          .attr("fill", 'steelblue')
          .text(this.evaluationSelection == 'accuracy'?'acc (uncertainty as uncertain)'
          :this.evaluationSelection == 'precision'? 'precision'
          :this.evaluationSelection == 'recall'? 'recall'
          :this.evaluationSelection == 'mcc'?'mcc'
          :'f1')
        accLegend.append('text')
          .attr("class","bin-text")
          .attr("transform",  "translate("+(-240)+"," +40 +")")
          .attr('font-size', '24px')
          .attr('text-anchor', 'left')
          .attr('alignment-baseline', 'middle')
          .attr("fill", 'steelblue')
          .text('acc- (uncertainty as wrong)')  
          .attr("visibility",this.evaluationSelection == 'accuracy'? "visible":"hidden")
          

        thresholdBins.append('line')
            .attr('class', 'track')
            .style("stroke", "lightgrey")
            .style("stroke-opacity", "1")
            .style("stroke-width", "6")
            .attr('x1', this.xScale.range()[0])
            .attr('x2', this.xScale.range()[1])
            .attr('y1', 0)
            .attr('y2', 0)

        let head1 = thresholdBins.append('rect')
            .attr('width',20)
            .attr('height',15)
            .attr('rx',6)
            .attr('ry',6) 
            .style('fill', 'steelblue')
            .style('stroke', 'none')
            .attr('class','slider-threshold-bin')
            .attr('transform', 'translate(100,-7.5)')
            .call(d3.drag()
              .on('start.interrupt', function () {
                head1.interrupt();
              })
              .on('start drag',  
              (d:string)=>this.numberOfBins = Math.round(this.xScale.invert(d3.event.x) * (20 / 200))//
              ))
             ;  
          thresholdBins.append('text')
          .attr("class","bin-text")
          .attr("transform",  "translate("+(-100)+"," +0 +")")
          .attr('font-size', '24px')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text("number of bins: "+this.numberOfBins)   

        
      };
      drawLegend();

      const drawAdjuster = () => { // adjuster框

        svg.append("rect")
        .attr('width', "205" )
        .attr('height', 70)
        .attr('fill', 'white')
        .attr("stroke","lightgrey")
        .attr("stroke-width","4px")
        .attr("x","2")
        .attr("y","-180")

        var sqrt3 = Math.sqrt(3);
        var triangleRight = {
          draw: function (context, size) {
              var x = -Math.sqrt(size / (sqrt3 * 3));
              context.moveTo(-x * 2, 0);
              context.lineTo(x, -sqrt3 * x);
              context.lineTo(x, sqrt3 * x);
              context.closePath();
            }
          };

          var triangleLeft = {
            draw: function (context, size) {
              var x = -Math.sqrt(size / (sqrt3 * 3));
              context.moveTo(x * 2, 0);
              context.lineTo(-x, -sqrt3 * x);
              context.lineTo(-x, sqrt3 * x);
              context.closePath();
            }
          };

          let leftTrgl = d3.symbol().type(triangleLeft)
            .size(180);
          let rightTrgl = d3.symbol().type(triangleRight)
            .size(180);

          let xScale = this.xScale;
            
          let yScale = this.yScale;
          
          let buttons = svg.append("rect")
            .attr("rx", 6)
            .attr("ry", 6)
            .attr("x", 3)
            .attr("y", -180)
            .attr("width", 140)
            .attr("height", 30)
            .attr("fill","#f2f2f2")
            .attr("stroke","lightgrey")
            
          let titles = svg.append("text")
            .attr("class","slider-text")
            .text("Range Adjuster")
            .attr("y",-160)
            .attr("x",5)
            .attr("font-size","20px")
            .attr("fill","grey")

          // set button
          let setbuttons = svg.append("rect")
            .attr("class","set-button")
            .attr("rx", 6)
            .attr("ry", 6)
            .attr("x", 150)
            .attr("y", -180)
            .attr("width", 40)
            .attr("height", 30)
            .attr("fill","#f2f2f2")
            .attr("stroke","lightgrey")
            .on('mouseenter', (d) => {
              d3.select(".set-button").attr("fill","grey")
              d3.select(".set-text").attr("fill","white")
            })
            .on('mouseleave', (d) => {
              d3.select(".set-button").attr("fill","#f2f2f2")
              d3.select(".set-text").attr("fill","grey")
            })
            .on('click', (d,i) => this.currentSetbandwidth = ({left: this.thresholdRangeChange.left_diff.toFixed(2), right: this.thresholdRangeChange.right_diff.toFixed(2)}));
            
          let settitles = svg.append("text")
            .attr("class","set-text")
            .text("set")
            .attr("y",-160)
            .attr("x",153)
            .attr("font-size","20px")
            .attr("fill","grey")
            .on('mouseenter', (d) => {
              d3.select(".set-button").attr("fill","grey")
              d3.select(".set-text").attr("fill","white")
            })
            .on('mouseleave', (d) => {
              d3.select(".set-button").attr("fill","#f2f2f2")
              d3.select(".set-text").attr("fill","grey")
            })
           .on('click', (d,i) => this.currentSetbandwidth = ({left: this.thresholdRangeChange.left_diff.toFixed(2), right: this.thresholdRangeChange.right_diff.toFixed(2)}));


          let slider = svg.append('line')
            .attr('class', 'track')
            .style("stroke", "#777")
            .style("stroke-opacity", "1")
            .style("stroke-width", "5")
            .attr('x1', 2)
            .attr('x2', 202)
            .attr('y1', -140)
            .attr('y2', -140)
 
          let head1 = svg.append('path') // 红色三角
            .attr('d', leftTrgl)
            .style('fill', 'red')
            .style('stroke', 'none')
            .attr('class','slider-circle-time-left')
            .attr('transform', d=>{
              let dis = 100 -  100 *  this.thresholdRangeChange.left_diff / 0.1 +2
              return 'translate('+dis+',-140)'
            })
            .call(d3.drag()
              .on('start.interrupt', function () {
                head1.interrupt();
              })
              .on('start drag',  
              (d:string)=>this.thresholdRangeChange = {"type":"left", "classifier":"all", "threshold":d, 
                      "value":xScale.invert(d3.event.x),"left_diff":Math.abs((parseFloat(xScale.invert(d3.event.x))-100) / 100 * 0.1),"right_diff": this.thresholdRangeChange.right_diff} //this.sliderRange =({type:"from", classifier:d, value: xScale.invert(d3.event.x)})//
              ))
             ;

          let head2 = svg.append('path') //绿色三角
            .attr('d', rightTrgl)
            .style('fill', 'green')
            .style('stroke', 'none')
            .attr('class','slider-circle-time-right')
            .attr('transform', d=>{
              let dis = 100 + 100 * (this.thresholdRangeChange.right_diff / 0.1)+2
              return 'translate('+dis+',-140)'
            })
            .call(d3.drag()
              .on('start.interrupt', function () {
                head2.interrupt();
              })
              .on('start drag',
              (d:string)=>this.thresholdRangeChange = {"type":"right", "classifier":"all", "threshold":d, 
                        "value":xScale.invert(d3.event.x),"left_diff": this.thresholdRangeChange.left_diff, "right_diff":Math.abs((parseFloat(xScale.invert(d3.event.x))-100) / 100 * 0.1)}
              ))
          let rangeTextLeft = svg.append("text")
            .attr("class","range-text-left")
            .text("("+(-this.thresholdRangeChange.left_diff.toFixed(2))+",")
            .attr("y",-120)
            .attr("x",5)
            .attr("font-size","18px")
            .attr("fill","grey")   
          let rangeTextRight = svg.append("text")
            .attr("class","range-text-right")
            .text(this.thresholdRangeChange.right_diff.toFixed(2)+")")
            .attr("y",-120)
            .attr("x",60)
            .attr("font-size","18px")
            .attr("fill","grey")   
      };

      const drawTitles = () => {
         svg_curves.append('text')
          .attr('transform', () => {
            const xOffset = this.width * 0.4;
            const yOffset = this.height + this.margin.bottom;
            return `translate(${xOffset}, ${yOffset})`;
          })
          .style('text-anchor', 'middle')
          .style('font-size', '24px')
          .text('Threshold');

        svg_curves.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('x', -this.height / 1.5)
          .attr('y', -this.margin.left * 0.9)
          .attr('dy', '1em')
          .style('text-anchor', 'middle')
          .style('font-size', '24px')
          .text('Fraction of instances');

        svg_curves.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('x', -this.height / 4)
          .attr('y', 60+ this.width * 0.8)
          .attr('dy', '1em')
          .style('text-anchor', 'middle')
          .style('font-size', '24px')
          .text(this.evaluationSelection == 'accuracy'? "Accuracy "
          :this.evaluationSelection == 'precision'? "Precision "
          :this.evaluationSelection == 'recall'? "Recall"
          :this.evaluationSelection == 'mcc'? "MCC"
          :"F1");

        svg_curves.append('text')
          .attr("class","curve-title")
          .attr('x', this.width * 0.4)
          .attr('y', -100)
          .attr('dy', '1em')
          .style('text-anchor', 'middle')
          .style('font-size', '32px')
          .text( 'Performance (' + c + ')');  
      };

      const drawAxes = () => {
        const xTAxis = (g: any) => g
          .attr('transform', `translate(${0}, ${this.height})`)
          .call(
            d3.axisBottom(xThreshold)
              .tickSizeOuter(0),
          )
          .attr("class","xAxis-curve");

        svg_curves.append('g')
          .call(xTAxis)
          .attr('font-size', 20)
          .selectAll('text')
          .attr('transform', 'rotate(30)')
          .attr('text-anchor', 'start')
          .on('click', (d: string) => this.leftThreshold = parseFloat(d).toFixed(2))
          .on('contextmenu', (d: string) => this.rightThreshold = parseFloat(d).toFixed(2));


        const yUnceratiny = d3.scaleLinear()
          .domain([0, 1])
          .range([this.height, 0]);

        const yTAxis = (g: any) => g
          .call(d3.axisLeft(yUnceratiny)
            .ticks(5)
            .tickFormat(evaluationKeys != 'mcc'? d3.format('.0%'):d3.format('.0')),
          );

        svg_curves.append('g')
          .call(yTAxis)
          .attr('font-size', 20);

        const yTAxis_acc = (g: any) => g
          .attr('transform', `translate(${this.width*0.8}, ${0})`)
          .call(d3.axisLeft(yThreshold)
            .ticks(5)
            .tickFormat(d3.format('.0%')),
          );

        svg_curves.append('g')
          .call(yTAxis_acc)
          .attr('font-size', 20)
          .selectAll('text')
          .attr('transform', `translate(${20}, ${0})`)
          .attr('text-anchor', 'start');


        // add reset button
        // svg_curves.append('rect')
        //   .attr('transform', `translate(${this.width - 200}, ${this.height})`)
        //   .attr("width",20)
        //   .attr("height",30)
        //   .attr("fill","lightgrey")

        // svg_curves.append("text")
        //   .attr('transform', `translate(${this.width - 100}, ${this.height})`)
        //   .attr("class","legend-text-hist")
        //   .attr('font-size', '24px')
        //   .attr('text-anchor', 'end')
        //   .attr('alignment-baseline', 'middle')
        //   .text( "Fraction of uncertainty") 
      };
      

      drawAxes();
      drawTitles();
      drawAdjuster();
    },
    drawStreamChart() {
      const chart = d3.select(this.$refs.svg);
      const selectedClassifier = this.value.length == 0? '' : this.value[this.value.length - 1].name;
      const xThreshold = d3.scaleBand<string>()
      .domain(this.thresholds)
      .range([0, this.width*0.8])
      .paddingOuter(0.2)
      .paddingInner(0.2);
      const yThreshold = this.yThreshold
      const svg_curves = chart.select(".svg-curve")
      svg_curves.selectAll('*').remove();
      const barThresholds = svg_curves.selectAll('.cell')
        .data(this.thresholds)
        .join('g')
          .attr('class', 'curve-cell')
          .attr('transform', function(d: string)  {
            return `translate(${xThreshold(d)}, ${0})`
          })
      const x = this.x    
      const y = this.y;
      const barWidth = xThreshold.bandwidth();
      const selectionBarWidth = xThreshold.bandwidth() / 8;
      const streamData = this.streamData;
      const instances = this.instances;
      const thresholds = this.thresholds;
      const accumulations = this.accumulations;
      const evaluationSelection = this.evaluationSelection;
      const yUnceratiny = d3.scaleLinear()
          .domain([0, 1])
          .range([this.height, 0]);
      let withinClassifierBandwidths = []
      this.withinClassifierBandwidths.forEach((i)=>{
        withinClassifierBandwidths.push(i)
      });
      let currentBandwidth = this.currentBandwidth
      
      if (Object.keys(streamData).length > withinClassifierBandwidths.length) {
        withinClassifierBandwidths.push(currentBandwidth)
      }
      

      const sortedBandWidth = withinClassifierBandwidths.sort((n1,n2) => {
          if ( (n1.right + n1.left) < (n2.right + n2.left)) {
              return 1;
          }

          if ( (n1.right + n1.left) > (n2.right + n2.left)) {
              return -1;
          }

          return 0;
      });
      const drawMiddelLine = () =>{
        function line(d,i) {
            return d3.line()(thresholds.map(function(p,j) { 
              if (evaluationSelection == 'accuracy') {
                return [xThreshold(p)+barWidth/4 , yThreshold((streamData[0].ci_tp[j] + streamData[0].ci_tn[j])/(instances.length - streamData[0].ci_m[j]))]; 
              } else if (evaluationSelection == 'recall') {
                return [xThreshold(p)+barWidth/4 , yThreshold(streamData[0].ci_tp[j] + streamData[0].ci_fn[j]!=0? (streamData[0].ci_tp[j] )/(streamData[0].ci_tp[j] + streamData[0].ci_fn[j]) :streamData[0].ci_tp[j] == 0? 1: 0)]; 
              } else if (evaluationSelection == 'precision') {
                return [xThreshold(p)+barWidth/4 , yThreshold(streamData[0].ci_tp[j] + streamData[0].ci_fp[j] == 0? 0:(streamData[0].ci_tp[j] )/(streamData[0].ci_tp[j] + streamData[0].ci_fp[j]))]; 
              } else if (evaluationSelection == 'f1') {
                let precision = streamData[0].ci_tp[j] + streamData[0].ci_fn[j] != 0?(streamData[0].ci_tp[j] )/(streamData[0].ci_tp[j] + streamData[0].ci_fn[j]):streamData[0].ci_tp[j] == 0? 1:0
                let recall  = streamData[0].ci_tp[j] + streamData[0].ci_fp[j] !=0 ?(streamData[0].ci_tp[j] )/(streamData[0].ci_tp[j] + streamData[0].ci_fp[j]) : streamData[0].ci_tp[j] == 0? 1:0
                return [xThreshold(p)+barWidth/4 , yThreshold(precision + recall !=0? 2*precision *recall / (precision + recall) : precision * recall != 0? 0:1)]; 
              } else {
                let tp = streamData[0].ci_tp[j]
                let fp = streamData[0].ci_fp[j]
                let tn = streamData[0].ci_tn[j]
                let fn = streamData[0].ci_fn[j]
                if ((tp+fp)*(tp+fn)*(tn+fp)*(tn+fn) != 0) {
                  return [xThreshold(p)+barWidth/4 , yThreshold(((tp*tn-fp*fn) / Math.sqrt((tp+fp)*(tp+fn)*(tn+fp)*(tn+fn))))]; 
                } else{
                  return [xThreshold(p)+barWidth/4 , yThreshold(0)]; 
                }
              }
            }));
          }

        svg_curves.append("path")
            .attr('class', 'line-threshold')
            .attr("d",  line)
            .style("fill", "none")
            .attr("stroke", "grey")
            .style("stroke-width", 3)
            .style("opacity", 1)   

      };
      const drawCurves = () =>{
        // sort storeBandwidth
        sortedBandWidth.forEach((bandwidth, c)=>{
          let index = c
          barThresholds  
            .append("rect")
            .attr('class', (d,i)=>'bar-threshold-band-'+c + '-' + i)
            .attr('y', (d,i) => yUnceratiny(this.streamData[c].ci_m[i] / this.instances.length))
            .attr('width', barWidth / 1.2)
            .attr('height', (d,i) => this.height - yUnceratiny(this.streamData[c].ci_m[i] / this.instances.length))
            .attr('fill', this.streamData[c].color)
            .attr('stroke', 'black')
            .style('paint-order', 'stroke')
            .on('mouseenter', (d,i) => this.barHover = ({threshold: 'threshold-'+ i}))
            .on('mouseleave', this.clearBarHover)
            .on('click', (d,i) => this.select(c, i, 'first', bandwidth))
            .on('contextmenu', (d,i) => this.select(c, i, 'second', bandwidth))
            .on('dblclick',(d,i)=>this.select(c, i, 'first', bandwidth, 'certainty'));  
      
          var pointsUp = barThresholds
            .append("line")
            .attr('class', (d,i)=>'upline-band-'+c + '-' + i)
            .attr('x1',  barWidth/6 * (index + 1)-6)
            .attr('y1',(d,i) => {
              return yThreshold((this.streamData[c].ci_tp[i] + this.streamData[c].ci_tn[i] +  this.streamData[c].ci_m[i])/(this.instances.length))
            })
            .attr('x2',  barWidth/6 * (index + 1)+6)
            .attr('y2', (d,i) => yThreshold((this.streamData[c].ci_tp[i] + this.streamData[c].ci_tn[i] + this.streamData[c].ci_m[i])/(this.instances.length)))
            .attr('stroke', this.streamData[c].color)
            .attr('stroke-width', '6px')
            .on('mouseenter', (d,i) => this.accHover = ({threshold: 'threshold-'+ i}))
            .on('mouseleave', this.clearAccHover)
            .attr("visibility",evaluationSelection == 'accuracy'? "visible":"hidden")
            .on('click', (d,i) =>this.click = {'threshold':this.thresholds[i], 'classifier': selectedClassifier})



          var pointsMiddle = barThresholds
            .append("line")
            .attr('class', (d,i)=>'midline-band-'+c + '-' + i)
            .attr('x1',  barWidth/6 * (index + 1)-6)
            .attr('y1',(d,i) => {
              let tp = streamData[c].ci_tp[i]
              let fp = streamData[c].ci_fp[i]
              let tn = streamData[c].ci_tn[i]
              let fn = streamData[c].ci_fn[i]
              let m_y = streamData[c].ci_m_y[i]
              let m_n = streamData[c].ci_m_n[i]
              let m = streamData[c].ci_m[i]
              if (evaluationSelection == 'accuracy') {
                return yThreshold((tp+tn)/(this.instances.length-m))
              } else if (evaluationSelection == 'recall') {
                return yThreshold(tp/(tp+fn))
              } else if (evaluationSelection == 'precision') {
                return yThreshold(tp/(tp+fp))
              } else if (evaluationSelection == 'f1') {
                let precision = tp / (tp+fp)
                let recall  = tp / (tp + fn)
                return yThreshold(2*precision*recall / (precision + recall))
              } else {
                if ((tp+fp)*(tp+fn)*(tn+fp)*(tn+fn) != 0) {
                  return yThreshold(((tp*tn-fp*fn) / Math.sqrt((tp+fp)*(tp+fn)*(tn+fp)*(tn+fn))))
                } else {
                  return yThreshold(0)
                }
              }
              }  
            )
            .attr('x2',  barWidth/6 * (index + 1)+6)
            .attr('y2', (d,i) => {
              let tp = streamData[c].ci_tp[i]
              let fp = streamData[c].ci_fp[i]
              let tn = streamData[c].ci_tn[i]
              let fn = streamData[c].ci_fn[i]
              let m_y = streamData[c].ci_m_y[i]
              let m_n = streamData[c].ci_m_n[i]
              let m = streamData[c].ci_m[i]
              if (evaluationSelection == 'accuracy') {
                return yThreshold((tp+tn)/(this.instances.length-m))
              } else if (evaluationSelection == 'recall') {
                return yThreshold(tp/(tp+fn))
              } else if (evaluationSelection == 'precision') {
                return yThreshold(tp/(tp+fp))
              } else if (evaluationSelection == 'f1') {
                let precision = tp / (tp+fp)
                let recall  = tp / (tp + fn)
                return yThreshold(2*precision*recall / (precision + recall))
              } else {
                if ((tp+fp)*(tp+fn)*(tn+fp)*(tn+fn) != 0) {
                  return yThreshold(((tp*tn-fp*fn) / Math.sqrt((tp+fp)*(tp+fn)*(tn+fp)*(tn+fn))))
                } else {
                  return yThreshold(0)
                }
              }
              }  )
            .attr('stroke', this.streamData[c].color)
            .attr('stroke-width', '6px')
            .on('mouseenter', (d,i) => this.accHover = ({threshold: 'threshold-'+ i}))
            .on('mouseleave', this.clearAccHover)
            .on('click', (d,i) =>this.click = {'threshold':this.thresholds[i], 'classifier': selectedClassifier})


          var pointsLow =  barThresholds
            .append("line")
            .attr('class', (d,i)=>'lowline-band-'+c + '-' + i)
            .attr('x1',  barWidth/6 * (index + 1)-6)
            .attr('y1',(d,i) => {
              return yThreshold((this.streamData[c].ci_tp[i] + this.streamData[c].ci_tn[i])/(this.instances.length))
            })
            .attr('x2',  barWidth/6 * (index + 1)+6)
            .attr('y2', (d,i) => yThreshold((this.streamData[c].ci_tp[i] + this.streamData[c].ci_tn[i])/(this.instances.length)))
            .attr('stroke', this.streamData[c].color)
            .attr('stroke-width', '6px')
            .on('mouseenter', (d,i) => this.accHover = ({threshold: 'threshold-'+ i}))
            .on('mouseleave', this.clearAccHover)
            .attr("visibility",evaluationSelection == 'accuracy'? "visible":"hidden")
            .on('click', (d,i) =>this.click = {'threshold':this.thresholds[i], 'classifier': selectedClassifier})


          barThresholds.append("line")
            .attr('class', (d,i)=>'line-band-'+c + '-' + i)
            .attr('x1',  barWidth/6 * (index + 1)-1)
            .attr('y1',(d,i) => {
              return yThreshold((this.streamData[c].ci_tp[i] + this.streamData[c].ci_tn[i] +  this.streamData[c].ci_m[i])/(this.instances.length))
              }  
            )
            .attr('x2',  barWidth/6 * (index + 1)-1)
            .attr('y2', (d,i) => yThreshold((this.streamData[c].ci_tp[i] + this.streamData[c].ci_tn[i])/(this.instances.length)))
            .attr('stroke', this.streamData[c].color)
            .attr('stroke-width', '4px')
            .attr("visibility",evaluationSelection == 'accuracy'? "visible":"hidden")

          index += 1
        })

        sortedBandWidth.forEach((bandwidth, c)=>{
          barThresholds 
            .append("circle")   
            .attr('r',(barWidth / 2.4) / sortedBandWidth.length)
            .attr('class', (d,i)=>'circle-threshold-band-'+c + '-' + i)
            .attr("cx", (barWidth / 1.2) / sortedBandWidth.length * (c+0.5))
            .attr("cy",  this.height - (barWidth / 2.4) / sortedBandWidth.length)
            .attr("visibility", (d,i) => {
              return (this.streamData[c].ci_m[i] != 0 && sortedBandWidth.length >=2 || (this.height -yThreshold(this.streamData[c].ci_m[i] / this.instances.length) >0 
                                      &&  this.height -yThreshold(this.streamData[c].ci_m[i] / this.instances.length) < barWidth / 3)) ? "visible":"hidden"
            })
            .attr("fill", this.streamData[c].color)  
            .attr('stroke', 'black')
            .attr('stroke-width', '0.5px')
            .on('mouseenter', (d,i) => this.barHover = ({threshold: 'threshold-'+ i}))
            .on('mouseleave', this.clearBarHover)
            .on('click', (d,i) => this.select(c, i, 'first', bandwidth))
            .on('contextmenu', (d,i) => this.select(c, i, 'second', bandwidth))
            .on('dblclick',(d,i)=>this.select(c, i, 'first', bandwidth, 'certainty')); 
            
        
          barThresholds.append('rect')
            .attr('class', (d,i)=>'bar-right-right-selection-1-'+c + '-' + i)
            .attr('y', (d: string) => y(1))
            .attr('x', barWidth / 2.4 - selectionBarWidth)
            .attr('width', selectionBarWidth)
            .attr('fill', this.selection1Color)
            .attr('stroke', 'black')
            .attr('stroke-width', '1px')
            .attr("visibility",  "hidden")
            ; 
          

          barThresholds.append('rect')
            .attr('class', (d,i)=>'bar-right-right-selection-2-'+c + '-' + i)
            .attr('y', (d: string) => y(1))
            .attr('x', barWidth / 2.4)
            .attr('width', selectionBarWidth)
            .attr('fill', this.selection2Color)
            .attr('stroke', 'black')
            .attr('stroke-width', '1px')
            .attr("visibility", "hidden")
            ; 
        })
      };

      const drawLegend = () => {
        svg_curves.selectAll("myCicle")
          .data(this.withinClassifierBandwidths)
          .enter().append("circle")
          .attr("class",(d,i)=>"bandwidth-"+ i)
          .attr("cx",this.width-10)
          .attr("cy",(d,i)=> this.height+(i + 2)*25)
          .attr("r", 6)
          .style("fill", (d,i)=>{
            return this.streamData[i]['color']
          })
          .on('mouseenter',(d,i)=>{
            this.bandwidthHover = ({bandwidth: 'bandwidth-'+i})})
          .on('mouseleave', (d,i)=>this.bandwidthHover = ({bandwidth: 'bandwidth-'}))  
          .on('click', (d, i) => this.currentRemovedbandwidth = d);
          
        svg_curves
          .selectAll("myText")
          .data(this.withinClassifierBandwidths)
          .enter().append("text")
          .attr("class",(d,i)=>"bandwidth-text-"+ i)
          .attr("x", this.width-180)
          .attr("y", (d,i)=> this.height+(i + 2)*25) 
          .text((d,i)=>"bandwidth: "+ this.streamData[i]['left'] + '-' + this.streamData[i]['right'])
          .style("font-size", "15px")
          .attr("alignment-baseline","middle")
          .on('mouseenter',(d,i)=>this.bandwidthHover = ({bandwidth: 'bandwidth-'+i}))
          .on('mouseleave', (d,i)=>this.bandwidthHover = ({bandwidth: 'bandwidth-'}))
          .on('click', (d, i) => this.currentRemovedbandwidth = d);


        
      };
      const drawTitles = () => {
         svg_curves.append('text')
          .attr('transform', () => {
            const xOffset = this.width * 0.4;
            const yOffset = this.height + this.margin.bottom;
            return `translate(${xOffset}, ${yOffset})`;
          })
          .style('text-anchor', 'middle')
          .style('font-size', '24px')
          .text('Threshold');

        svg_curves.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('x', -this.height / 1.5)
          .attr('y', -this.margin.left * 0.9)
          .attr('dy', '1em')
          .style('text-anchor', 'middle')
          .style('font-size', '24px')
          .text('Fraction of instances');

        svg_curves.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('x', -this.height / 4)
          .attr('y', 60+ this.width * 0.8)
          .attr('dy', '1em')
          .style('text-anchor', 'middle')
          .style('font-size', '24px')
          .text(this.evaluationSelection == 'accuracy'? "Accuracy "
          :this.evaluationSelection == 'precision'? "Precision"
          :this.evaluationSelection == 'recall'? "Recall "
          :this.evaluationSelection == 'mcc'? "MCC "
          :"F1");

        svg_curves.append('text')
          .attr("class","curve-title")
          .attr('x', this.width * 0.4)
          .attr('y', -100)
          .attr('dy', '1em')
          .style('text-anchor', 'middle')
          .style('font-size', '32px')
          .text( 'Performance (' + selectedClassifier + ')');  
      };
      const drawAxes = () => {
        const xTAxis = (g: any) => g
          .attr('transform', `translate(${0}, ${this.height})`)
          .call(
            d3.axisBottom(xThreshold)
              .tickSizeOuter(0),
          )
          .attr("class","xAxis-curve");

        svg_curves.append('g')
          .call(xTAxis)
          .attr('font-size', 20)
          .selectAll('text')
          .attr('transform', 'rotate(30)')
          .attr('text-anchor', 'start')
          .on('click', (d: string) => this.leftThreshold = parseFloat(d).toFixed(2))
          .on('contextmenu', (d: string) => this.rightThreshold = parseFloat(d).toFixed(2));


        const yUnceratiny = d3.scaleLinear()
          .domain([0, 1])
          .range([this.height, 0]);
        const yTAxis = (g: any) => g
          .call(d3.axisLeft(yUnceratiny)
            .ticks(5)
            .tickFormat(d3.format('.0%')),
          );

        svg_curves.append('g')
          .call(yTAxis)
          .attr('font-size', 20);

        const yTAxis_acc = (g: any) => g
          .attr('transform', `translate(${this.width*0.8}, ${0})`)
          .call(d3.axisLeft(yThreshold)
            .ticks(5)
            .tickFormat(d3.format('.0%')),
          );

        svg_curves.append('g')
          .call(yTAxis_acc)
          .attr('font-size', 20)
          .selectAll('text')
          .attr('transform', `translate(${20}, ${0})`)
          .attr('text-anchor', 'start');

        // add reset button
        svg_curves.append('rect')
          .attr('transform', `translate(${ -100}, ${this.height})`)
          .attr("width",60)
          .attr("height",30)
          .attr("fill","lightgrey")
          .on('click', (d: string) => this.clearThresholdBound());

        svg_curves.append("text")
          .attr('transform', `translate(${ -70}, ${this.height + 15})`)
          .attr("class","legend-text-hist")
          .attr('font-size', '24px')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text( "reset") 
          .on('click', (d: string) => this.clearThresholdBound());

        // add remove all button
        svg_curves.append('rect')
          .attr('transform', `translate(${this.width -120}, ${this.height})`)
          .attr("width",120)
          .attr("height",30)
          .attr("fill","lightgrey")
          .on('click', (d: string) => this.clearBandwitdth());

        svg_curves.append("text")
          .attr('transform', `translate(${ this.width-60}, ${this.height + 15})`)
          .attr("class","legend-text-hist")
          .attr('font-size', '24px')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text( "remove all") 
          .on('click', (d: string) => this.clearBandwitdth());

        // add default button
        svg_curves.append('rect')
          .attr('transform', `translate(${this.width -120}, ${this.height - 45})`)
          .attr("width",120)
          .attr("height",30)
          .attr("fill","lightgrey")
          .on('click', (d: string) => this.addDefault());

        svg_curves.append("text")
          .attr('transform', `translate(${ this.width-60}, ${this.height -30})`)
          .attr("class","legend-text-hist")
          .attr('font-size', '24px')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text( "add default") 
          .on('click', (d: string) => this.addDefault());


      };

      const yAxisMarkerLine = () => {
        let svg = svg_curves
        svg.append('line')
          .attr('class', 'y-axis-marker-line-1')
          .attr('y1', y(1))
          .attr('x2', this.width)
          .attr('y2', y(1))
          .attr('stroke', 'black')
          .attr('stroke-width', '2px')
          .attr('stroke-opacity', 0)
          .attr("opacity", '0.5')
          .attr('pointer-events', 'none');
        svg.append('line')
          .attr('class', 'y-axis-marker-line-2')
          .attr('y1', y(1))
          .attr('x2', this.width)
          .attr('y2', y(1))
          .attr('stroke', 'black')
          .attr('stroke-width', '2px')
          .attr('stroke-opacity', 0)
          .attr("opacity", '0.5')
          .attr('pointer-events', 'none');  

        svg.append('line')
          .attr('class', 'y-axis-marker-line-3')
          .attr('y1', y(1))
          .attr('x2', this.width)
          .attr('y2', y(1))
          .attr('stroke', 'black')
          .attr('stroke-width', '2px')
          .attr('stroke-opacity', 0)
          .attr("opacity", '0.5')
          .attr('pointer-events', 'none'); 
      };

      const yAxisMarkerText = () => {
        let svg = svg_curves
        svg.append('rect')
          .attr('class', 'y-axis-marker-rect')
          .attr('width', '400')
          .attr('height', sortedBandWidth.length * 40)
          .attr("x",this.width-this.margin.right-400)
          .attr("y",-55)
          .attr('fill', "white")
          .attr('stroke',"lightgrey")
          .attr('stroke-width',"2px")
          .transition()
          .duration(1000)
          .attr('opacity', 0);  
        
        let i = 0
        sortedBandWidth.forEach((bandwidth,c)=>{
          svg.append('text')
            .attr('class', 'y-axis-marker-text-1-'+c)
            .attr('transform', 'translate(' +(this.width-this.margin.right- 400)+ ', '+(-50+i * 22)+')') 
            // .attr('text-anchor', 'middle')
            .attr('alignment-baseline', 'hanging')
            .attr('font-size', 20)
            .attr('fill', "grey")
            .attr('pointer-events', 'none')
            .attr("opacity", 0);
          
          svg.append('text') 
            .attr('class', 'y-axis-marker-text-1-s1-'+c)
            .attr('transform', 'translate(' +(this.width-this.margin.right-250)+', '+(-50+i * 22)+')') 
            .attr('alignment-baseline', 'hanging')
            .attr('font-size', 20)
            .attr('fill', "steelblue")
            .attr('pointer-events', 'none')
            .attr("opacity", 0);;
          
          svg.append('text')
            .attr('class', 'y-axis-marker-text-1-s2-'+c)
            .attr('transform', 'translate(' +(this.width-this.margin.right-120)+ ', '+(-50+i * 22)+')') 
            .attr('alignment-baseline', 'hanging')
            .attr('font-size', 20)
            .attr('fill', "red")
            .attr('pointer-events', 'none')
            .attr("opacity", 0);;
          i ++;
        })
      };
      

      
      drawAxes();
      drawTitles();
      drawLegend();
      drawCurves();
      drawMiddelLine();
      yAxisMarkerText();
      this.drawSelections();
      
    },
    
    drawSelections() {
      // @ts-ignore
      const chart = d3.select(this.$refs.svg);
      const formatDecimal = d3.format(".1f")

      const { first, second } = this.selections;
      const yUnceratiny = d3.scaleLinear()
          .domain([0, 1])
          .range([this.height, 0]);

      const curveOffset = (bandwidth:number, threshold:number,  selection: Set<string>) => {
        const instances = this.streamData[bandwidth]["middle_instances"][this.thresholds[threshold]].instances
        const overlappingInstances = intersection(instances, selection);
        var totalInstances = 0 
        totalInstances = this.instances.length
        const fractionOfTotalInstances = overlappingInstances.size / totalInstances;
        return yUnceratiny(fractionOfTotalInstances);
      };

      let withinClassifierBandwidths = []
      this.withinClassifierBandwidths.forEach((i)=>{
        withinClassifierBandwidths.push(i)
      });
      const sortedBandWidth = withinClassifierBandwidths.sort((n1,n2) => {
          if ( (n1.right + n1.left) < (n2.right + n2.left)) {
              return 1;
          }

          if ( (n1.right + n1.left) > (n2.right + n2.left)) {
              return -1;
          }
          return 0;
      });

      sortedBandWidth.forEach((bandwidth, c)=>{
        this.thresholds.forEach((t, i)=>{
          if (!first){
            chart.select('.bar-right-right-selection-1-'+c + '-' + i).attr("visibility",  "hidden")
          } else {
            chart.select('.bar-right-right-selection-1-'+c + '-' + i)
              .attr("height",(d: string) =>this.height -  curveOffset(c,i,first.instances))
              .attr("y",(d: string) => curveOffset(c,i,first.instances))
              .attr("visibility",  "visible")
          }
          if (!second) {
            chart.select('.bar-right-right-selection-2-'+c + '-' + i).attr("visibility",  "hidden")
          } else {
            chart.select('.bar-right-right-selection-2-'+c + '-' + i)
              .attr("height",(d: string) => this.height - curveOffset(c,i,second.instances))
              .attr("y",(d: string) => curveOffset(c,i,second.instances))
              .attr("visibility",  "visible")
          }
        })
      })
    },
    select(
      bandwidth: number,
      threshold:number,
      whichOverlap: 'first' | 'second',
      bandwidthRange:string,
      type:string
    ) {
      d3.event.preventDefault();
      d3.event.stopPropagation();

      const constraint = blankConstraint();
      constraint.rule = Rule.RIGHT;
      constraint.classifier = this.value.length == 0? '' : this.value[this.value.length - 1].name;;


      let instances = this.streamData[bandwidth]["middle_instances"][this.thresholds[threshold]].instances
      let leftEdge = (parseFloat(this.thresholds[threshold]) - parseFloat(bandwidthRange['left'])).toFixed(2)
      let rightEdge = (parseFloat(this.thresholds[threshold]) + parseFloat(bandwidthRange['right'])).toFixed(2)

      let description = `Instances which ${constraint.classifier} got uncertain under${leftEdge} and ${rightEdge}`;


      if (type ==  'certainty') {
        let tmp_instances = [...this.streamData[bandwidth]["ci_tp_instances"][this.thresholds[threshold]].instances];
        [...this.streamData[bandwidth]["ci_fp_instances"][this.thresholds[threshold]].instances].forEach((item)=>{
          tmp_instances.push(item)
        });
        [...this.streamData[bandwidth]["ci_tn_instances"][this.thresholds[threshold]].instances].forEach((item)=>{
          tmp_instances.push(item)
        });
        [...this.streamData[bandwidth]["ci_fn_instances"][this.thresholds[threshold]].instances].forEach((item)=>{
          tmp_instances.push(item)
        });
        instances = new Set(tmp_instances)
        description = `Instances which ${constraint.classifier} got certain under${leftEdge} and ${rightEdge}`;
        }

      const predicate: PredicateSimple = {
        type: 'simple',
        constraints: [constraint],
        metric: []
      };
      const payload = {
        description,
        instances,
        predicate,
      };

      this.$store.dispatch('prependToSelectionHistory', payload);
      this.$store.dispatch('changedMostRecentSelection', whichOverlap);
    },
  },
});
</script>

<style scoped>
.card {
  background-color: white;
  display: inline-block
}

.track-overlay {
  pointer-events: stroke;
  stroke-width: 20px;
}


</style>
