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
            <span>(Trinary) Rejected Curve</span>
          </div>
        </v-expansion-panel-header>
        <v-expansion-panel-content>
            <v-radio-group v-model="evaluationKeys" label="Evaluation method">
            <v-radio label="conditional accuracy" value="c_accuracy"></v-radio>
            <v-radio label="accuracy" value="accuracy"></v-radio>
            <v-radio id="mcc" label="mcc" value="mcc"></v-radio>
            <v-radio label="f1" value="f1"></v-radio>
            <v-radio label="precision" value="precision"></v-radio>
            <v-radio  label="recall" value="recall"></v-radio>
          </v-radio-group>

          <v-radio-group v-model="selection_mode" label="Selection Mode">
              <v-radio label="overall curve " value="overall"></v-radio>
              <v-radio label="selection curve" value="selected"></v-radio>
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
import { range, selection } from 'd3';

export default Vue.extend({
  name: 'Rejected_Curve',
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
      info: '',
      idx: '',
      line_idx: ''
    };
    const click = {
      classifier: '',
      left_range: '',
      right_range: ''
    };
    const lineHover = {
      info: '',
      line_idx: ''
    };
    const evaluationKeys = 'c_accuracy' as 'mcc'| 'f1' | 'precision'| 'recall'| 'accuracy' | 'c_accuracy'

    const bandwidthHover = {
      bandwidth: '',
    }
    const barHover  = {
      threshold: '',
    }
    const accHover  = {
      threshold: '',
    }
    const currentThresholds = {
      threshold: '',
    }
    const selection_mode = 'overall' as 'overall' | 'selected'

    const curveClassifier = [...this.boxProps.classifiers][3];
    const upperColors = ["rgb(37,102,118)", "rgb(138,225,249)"]
    const lowerColors = ["rgb(181,29,73)", "rgb(251,137,155)"]
    const middleColors = ["rgb(64,57,150)","rgb(119,136,153)"]


    return {
      selectedPred: {},
      classifierBuckets: {},
      selection_mode,
      leftRate: 0,
      rightRate: 1,
      multilClassifier: 'no',
      thresholdList: [],
      currentThresholds,
      tmp_threshold: 0.50,
      barHover,
      evaluationKeys,
      accHover,
      bandwidthHover,
      leftThreshold: 0.00,
      rightThreshold: 1.00,
      streamData: {},
      value: [],
      height,
      hover,
      click,
      lineHover,
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
      numberOfBins: 0.50,
      thresholdRangeRecords:{},
      upperColors,
      middleColors,
      lowerColors,
    };
  },
  computed: {
    thresholds():string[] {
      let threshold = 0.00
      let interval = 0.02
      let thresholds = []
      while (threshold <= 1){
        thresholds.push(threshold.toFixed(2))
        threshold += interval
      }
      return thresholds
    },

    instances(): string[] {
      return [...this.boxProps.instances];
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
    predictions(): {} {
      let interval = 0.02
      let diff_interval  = 0.02

      let classifierBuckets = {}
      let predictions = {}
      

      this.classifiers.forEach((c)=>{
        let buckets = {}
        let begin = 0.00
        while (begin < 1) {
          let tmp_key = begin.toFixed(2) + '-' + (begin+interval).toFixed(2)
          buckets[tmp_key] = []
          begin += interval
        }
        this.instances.forEach((id)=>{
          let continuous_value = (instanceById(id).continuous_predictions[c])
          let bucket_idx = Math.floor(continuous_value * 100 / 2)
          let tmp_key = ((bucket_idx) * interval).toFixed(2) + '-' + ((bucket_idx+1) * interval).toFixed(2)
          if (bucket_idx == 50) {
            tmp_key = '0.98-1.00'
          }
          if (!((parseFloat(continuous_value) - (bucket_idx * interval)) > 0) && bucket_idx != 0) {
            tmp_key = ((bucket_idx-1) * interval).toFixed(2) + '-' + ((bucket_idx ) * interval).toFixed(2)
          }
          buckets[tmp_key].push({'id':id, 'value':parseFloat(continuous_value).toFixed(3)})
        })
        classifierBuckets[c] = buckets
      })

      this.classifierBuckets = classifierBuckets;


      const calcuate_res = (c, cur_threshold, left_edge, right_edge) =>{
        let res = {
          'left_edge': left_edge.toFixed(2),
          'right_edge': right_edge.toFixed(2),
          'rejec_rate':0,
          'c_acc':0,
          'acc':0,
          'recall':0,
          'precision':0,
          'mcc':0,
          'f1':0,
          'm_tp':0,
          'm_tn':0,
          'm_fn':0,
          'm_fp':0,
          'm':0,
          'tp':0,
          'tn':0,
          'fp':0,
          'fn':0,
          'tp_instances':[],
          'm_tp_instances':[],
          'totoal':0
        }
        this.instances.forEach((id)=>{
          let continuous_value = (instanceById(id).continuous_predictions[c])
          res['totoal'] += 1
          if (continuous_value > left_edge && continuous_value < right_edge) {
              res['m'] += 1
              if (instanceById(id).actual == this.classes[1]) {
                if (continuous_value >= cur_threshold) {
                  res['m_tp'] += 1
                  res['m_tp_instances'].push({'id':id, 'value':continuous_value})
                } else {
                  res['m_fn'] += 1
                }
              } else {
                if (continuous_value < cur_threshold) {
                  res['m_tn'] += 1
                } else {
                  res['m_fp'] += 1
                }
              }
          } else if (continuous_value >= right_edge){
            if (instanceById(id).actual == this.classes[1]){
              res["tp"] += 1
              res['tp_instances'].push({'id':id, 'value':continuous_value})
            } else {
              res["fp"] += 1
            }
          } else{
            if (instanceById(id).actual == this.classes[0]) {
              res["tn"] += 1
            } else {
              res["fn"] += 1
            }
          }
        })
        res['rejec_rate'] = res['m'] / res['totoal']
        res['c_acc'] =(res['totoal'] - res['m']) == 0? 1 : (res['tp'] + res['tn']) / (res['totoal'] - res['m'])
        res['acc'] = (res['tp'] + res['tn']) / res['totoal']
        res['precision'] =  (( res['tp']  +  res['fp']) == 0? 0:(res['tp']) / ( res['tp']  +  res['fp']))
        res['recall'] = (( res['tp']  +  res['fn']) == 0 ? 0:(res['tp']) / ( res['tp']  +  res['fn']))
        res['f1']  = (res['recall'] + res['precision']) ==0 ? 0: (2*res['recall']*res['precision']) / (res['recall'] + res['precision'])
        if (res['rejec_rate'] == 1) {
          res['mcc'] = 1
        } else {
          if ((Math.sqrt((res.tp + res.fp) * (res.tp + res.fn) * (res.tn + res.fp) * (res.tn + res.fn))) == 0) {
            res['mcc'] = 0;
          } else {
            res['mcc'] = res['rejec_rate'] == 1? 1:((res.tp*res.tn-res.fp*res.fn) / Math.sqrt((res.tp + res.fp) * (res.tp + res.fn) * (res.tn + res.fp) * (res.tn + res.fn)))
          }
        }
        
        return res
      }

      const get_res = (c, threshold, left_edge, right_edge, last_res) =>{
        if (parseFloat(left_edge.toFixed(2)) == parseFloat(right_edge.toFixed(2))) {
          let res = calcuate_res(c, threshold, left_edge, right_edge)
          return res
        }
        let res = {
          'left_edge': parseFloat(left_edge.toFixed(2)),
          'right_edge': parseFloat(right_edge.toFixed(2)),
          'rejec_rate':0,
          'c_acc':0,
          'acc':0,
          'recall':0,
          'precision':0,
          'mcc':0,
          'f1':0,
          'm_tp':last_res.m_tp,
          'm_tn':last_res.m_tn,
          'm_fn':last_res.m_fn,
          'm_fp':last_res.m_fp,
          'm':last_res.m,
          'tp':last_res.tp,
          'tn':last_res.tn,
          'fp':last_res.fp,
          'fn':last_res.fn,
          'totoal':last_res.totoal
        }
        // left side
        let tmp_left_key = (Math.abs(left_edge).toFixed(2)) + '-' + (parseFloat(last_res['left_edge'].toString()).toFixed(2))
        let tmp_left_next_key = tmp_left_key
        if (parseFloat(Math.abs(left_edge).toFixed(2)) > 0) {
          tmp_left_next_key = (Math.abs(left_edge-0.02).toFixed(2)) + '-'+ (Math.abs(left_edge).toFixed(2))
        }
        let left_instances = [...classifierBuckets[c][tmp_left_key],classifierBuckets[c][tmp_left_next_key]]
        let tmp_right_key = (parseFloat(last_res['right_edge'].toString()).toFixed(2)) + '-' + right_edge.toFixed(2)
        let tmp_right_before_key = tmp_right_key
        if (parseFloat(Math.abs(last_res['right_edge']).toFixed(2)) > 0) {
          tmp_right_before_key =(parseFloat((last_res['right_edge']-0.02).toString()).toFixed(2)) + '-' + (parseFloat(last_res['right_edge'].toString()).toFixed(2)) 
        }
        
        let right_instances = [...classifierBuckets[c][tmp_right_key],...classifierBuckets[c][tmp_right_before_key]]

        left_instances.forEach((id)=>{
          if (res.left_edge > 0) {
            if (parseFloat(id.value) > res.left_edge && parseFloat(id.value) <= last_res.left_edge) {
              
              if(instanceById(id.id).actual == this.classes[1]) {
                if (res['fn'] > 0) {
                  res['fn'] -= 1
                  res['m_fn'] += 1
                  res['m'] += 1
                }
              } else {
                if (res['tn'] > 0) {
                  res['tn'] -=1
                  res['m_tn'] += 1
                  res['m'] += 1
                }
              }
            }
          } else {
            if (parseFloat(id.value) >= res.left_edge && parseFloat(id.value) <= last_res.left_edge) {
              if(instanceById(id.id).actual == this.classes[1]) {
                if (res['fn'] > 0) {
                  res['fn'] -= 1
                  res['m_fn'] += 1
                  res['m'] += 1
                }
              } else {
                if (res['tn'] > 0) {
                  res['tn'] -=1
                  res['m_tn'] += 1
                  res['m'] += 1
                }
              }
            }
          }
          
          
        })
        right_instances.forEach((id)=>{
          if(res.right_edge < 1) {
            if (parseFloat(id.value) > last_res.right_edge && parseFloat(id.value) <= res.right_edge){   
              if(instanceById(id.id).actual == this.classes[1]) {
                if (res['tp'] > 0) {
                  res['tp'] -= 1
                  res['m_tp'] += 1
                  res['m'] += 1       
                } 
              } else {
                if (res['fp']>0) {
                  res['fp'] -=1
                  res['m_fp'] += 1
                  res['m'] += 1         
                }
              }
            }
          } else {
            if (parseFloat(id.value) >= last_res.right_edge && parseFloat(id.value) <= res.right_edge){
                
              if(instanceById(id.id).actual == this.classes[1]) {
                if (res['tp']>0) {
                  res['tp'] -= 1
                  res['m_tp'] += 1
                  res['m'] += 1         
                }
                  
              } else {
                if (res['fp']>0) {
                  res['fp'] -=1
                  res['m_fp'] += 1
                  res['m'] += 1         
                }
              }
            }
          }
          
        }) 

        res['rejec_rate'] = res['m'] / res['totoal']
        res['c_acc'] =(res['totoal'] - res['m']) == 0? 1 : (res['tp'] + res['tn']) / (res['totoal'] - res['m'])
        res['acc'] = (res['tp'] + res['tn']) / res['totoal']
        res['precision'] =  res['rejec_rate'] == 1?1:(( res['tp']  +  res['fp']) != 0? (res['tp']) / ( res['tp']  +  res['fp']) : res['tp'] > 0? 1:0)
        res['recall'] = res['rejec_rate'] == 1? 1:(( res['tp']  +  res['fn']) != 0 ? (res['tp']) / ( res['tp']  +  res['fn']) : res['tp'] > 0? 1 :0)
        res['f1']  = (res['recall'] + res['precision']) ==0 ? 0: (2*res['recall']*res['precision']) / (res['recall'] + res['precision'])
        if (res['rejec_rate'] == 1) {
          res['mcc']  = 1
        } else {
          if ((Math.sqrt((res.tp + res.fp) * (res.tp + res.fn) * (res.tn + res.fp) * (res.tn + res.fn))) == 0 ) {
            res['mcc'] = 0;
          } else {
            res['mcc'] =  ((res.tp*res.tn-res.fp*res.fn) / Math.sqrt((res.tp + res.fp) * (res.tp + res.fn) * (res.tn + res.fp) * (res.tn + res.fn)))
          }
        }
        
        return res
      }

      let new_predictions = {}
      this.classifiers.forEach((c)=>{
        new_predictions[c] = {}
        let threshold = 0.00
        while (threshold <= 1) {
          new_predictions[c][threshold.toFixed(2)] = []
          let left_diff = threshold
          let right_diff = threshold
          let last_res = {}
          while (parseFloat(left_diff.toFixed(2)) >=0 && parseFloat(right_diff.toFixed(2)) <= 1) {
            let tmp_res = get_res(c, threshold, left_diff, right_diff, last_res)
            new_predictions[c][threshold.toFixed(2)].push(tmp_res)
            right_diff += diff_interval
            left_diff -= diff_interval
            last_res = tmp_res
          }
          threshold += interval
        }
      })

   
      return new_predictions
    },
    selections(): {
      first: SelectionRecord | null,
      second: SelectionRecord | null,
    } {
      return this.$store.state.overlapSelections;
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
        if (view.name == 'Rejected_Curve') {
          if (view.config) {
            let value  = view.config;
            this.value = []
            value.classifiers.forEach((c)=>{
              if (this.classifiers.includes(c)) {
                this.value.push({'name':c})
              }
            })
            this.selection_mode = value.selection
            this.evaluationKeys = value.evaluation
          }
        }
      })
      this.drawWithinInitial();
    },
    saveStatus() {
      let config = {"name":"Rejected_Curve", 
                    "config": {
                      "classifiers":this.value.map((c)=>c.name),
                      "selection":this.selection_mode,
                      "evaluation":this.evaluationKeys}}
      this.$store.dispatch("changedSaveConfig",config)
    },
    click() {
      this.$store.dispatch("changedOuterBandWidth", this.click)
    },
    selection_mode( ) {
      if (this.selection_mode == 'selected') {
        this.updateSelectedPred();
        this.drawSelectionChart();  
      } else {
        this.drawStreamChart();
      }
    },
    leftRate() {
      if (this.selection_mode == 'selected') {
        this.updateSelectedPred();
        this.drawSelectionChart();  
      } else {
        this.drawStreamChart();
      }
    },
    rightRate() {
      if (this.selection_mode == 'selected') {
        this.updateSelectedPred();
        this.drawSelectionChart();  
      } else {
        this.drawStreamChart();
      }
    },
    classifierThresholds() {
      if (this.multilClassifier == 'yes') {
        this.drawStreamChart();
      }
    },
    currentThresholds() {
      this.thresholdList.push(this.currentThresholds.threshold)
    },
    thresholdList() {
      this.drawStreamChart()
    },
    evaluationKeys() { 
      if (this.selection_mode == 'selected') {
        this.updateSelectedPred();
        this.drawSelectionChart();  
      } else {
        this.drawStreamChart();
      }
    },
    value() {
      if (this.value.length > 1) {
        this.multilClassifier = 'yes'
      } else {
        this.multilClassifier = 'no'
      }
      this.selection_mode = 'overall'
      this.drawWithinInitial();
      this.drawStreamChart();
    },
    hover() { 
      this.drawHover();
    },
    lineHover() {
      this.drawLineHover();
    },
    numberOfBins() {
      this.selection_mode = 'overall'
      this.updatenumberOfBins();
    },
    tmp_threshold() {
      this.drawStreamChart();
    },
    instances() {
      this.drawWithinInitial();
      if (this.selection_mode == 'selected') {
        this.updateSelectedPred();
        this.drawSelectionChart();  
      } else {
        this.drawStreamChart();
      }
    },

  },
  mounted() {
    let viewsConfig = this.$store.state.viewsConfig;
    viewsConfig.forEach((view)=>{
      if (view.name == 'Rejected_Curve') {
        if (view.config) {
          let value  = view.config;
          this.value = []
          value.classifiers.forEach((c)=>{
            if (this.classifiers.includes(c)) {
              this.value.push({'name':c})
            }
          })
          this.selection_mode = value.selection
          this.evaluationKeys = value.evaluation
        }
      }
    })
    this.drawWithinInitial();
  },
  methods: {
    clearHover() { 
      this.hover = ({'info':'', 'idx':'', 'line_idx': ''});
    },
    updateSelectedPred() {
      let interval = 0.02
      let diff_interval  = 0.02

      let classifierBuckets = this.classifierBuckets
      let predictions = {}
      let selectedClassifier = this.value.length == 0? '' : this.value[this.value.length - 1].name;


      const calcuate_res = (c, cur_threshold, left_edge, right_edge, instances) =>{
        let res = {
          'left_edge': left_edge.toFixed(2),
          'right_edge': right_edge.toFixed(2),
          'rejec_rate':0,
          'c_acc':0,
          'acc':0,
          'recall':0,
          'precision':0,
          'mcc':0,
          'f1':0,
          'm_tp':0,
          'm_tn':0,
          'm_fn':0,
          'm_fp':0,
          'm':0,
          'tp':0,
          'tn':0,
          'fp':0,
          'fn':0,
          'tp_instances':[],
          'm_tp_instances':[],
          'totoal':0
        }
        instances.forEach((id)=>{
          let continuous_value = (instanceById(id).continuous_predictions[c])
          res['totoal'] += 1
          if (continuous_value > left_edge && continuous_value < right_edge) {
              res['m'] += 1
              if (instanceById(id).actual == this.classes[1]) {
                if (continuous_value >= cur_threshold) {
                  res['m_tp'] += 1
                  res['m_tp_instances'].push({'id':id, 'value':continuous_value})
                } else {
                  res['m_fn'] += 1
                }
              } else {
                if (continuous_value < cur_threshold) {
                  res['m_tn'] += 1
                } else {
                  res['m_fp'] += 1
                }
              }
          } else if (continuous_value >= right_edge){
            if (instanceById(id).actual == this.classes[1]){
              res["tp"] += 1
              res['tp_instances'].push({'id':id, 'value':continuous_value})
            } else {
              res["fp"] += 1
            }
          } else{
            if (instanceById(id).actual == this.classes[0]) {
              res["tn"] += 1
            } else {
              res["fn"] += 1
            }
          }
        })
        res['rejec_rate'] = res['m'] / res['totoal']
        res['c_acc'] =(res['totoal'] - res['m']) == 0? 1 : (res['tp'] + res['tn']) / (res['totoal'] - res['m'])
        res['acc'] = (res['tp'] + res['tn']) / res['totoal']
        res['precision'] =  (( res['tp']  +  res['fp']) == 0? 0:(res['tp']) / ( res['tp']  +  res['fp']))
        res['recall'] = (( res['tp']  +  res['fn']) == 0 ? 0:(res['tp']) / ( res['tp']  +  res['fn']))
        res['f1']  = (res['recall'] + res['precision']) ==0 ? 0: (2*res['recall']*res['precision']) / (res['recall'] + res['precision'])
        if (res['rejec_rate'] == 1) {
          res['mcc'] = 1
        } else {
          if ((Math.sqrt((res.tp + res.fp) * (res.tp + res.fn) * (res.tn + res.fp) * (res.tn + res.fn))) == 0) {
            res['mcc'] = 0;
          } else {
            res['mcc'] = res['rejec_rate'] == 1? 1:((res.tp*res.tn-res.fp*res.fn) / Math.sqrt((res.tp + res.fp) * (res.tp + res.fn) * (res.tn + res.fp) * (res.tn + res.fn)))
          }
        }
        return res
      }

      let c = selectedClassifier
      const {first, second} = this.selections;
      let selectionList = [[...first.instances], [...second.instances]]
      
      let threshold = 0.00
      selectionList.forEach((tmp_selection, idx)=>{
        predictions[idx] = {}
        threshold = 0.00
        while (threshold <= 1) {
          predictions[idx][threshold.toFixed(2)] = []
          let left_diff = threshold
          let right_diff = threshold
          while (parseFloat(left_diff.toFixed(2)) >=0 && parseFloat(right_diff.toFixed(2)) <= 1) {
            let tmp_res = calcuate_res(c, threshold, left_diff, right_diff, tmp_selection)
            predictions[idx][threshold.toFixed(2)].push(tmp_res)
            right_diff += diff_interval
            left_diff -= diff_interval
          }
          threshold += interval
        }
      })

      this.selectedPred = predictions
      
      
    },
    updatenumberOfBins() {
      const chart = d3.select(this.$refs.svg);
      const svg_curve = chart.select(".svg-curve")
      const thresholdBin = chart.select('.slider-threshold-bin').attr('transform', 'translate(' + this.xScale((this.numberOfBins * 20)*(200/20)) + ', -7.5)') 

      if (this.thresholds.includes((parseFloat(this.numberOfBins)).toFixed(2))) {
        const thresholdBinText = chart.select('.bin-text').text("Threshold: " + this.numberOfBins)
        this.tmp_threshold = (parseFloat(this.numberOfBins)).toFixed(2)
      }
    },

    drawLineHover() {
      const chart = d3.select(this.$refs.svg);
      const classifier = this.value[0].name

      let tmp_thresholdList = []
      this.thresholdList.forEach((t)=>{
        tmp_thresholdList.push(t)
      })
      tmp_thresholdList.push(this.tmp_threshold)


      if (this.lineHover.line_idx) {
        tmp_thresholdList.forEach((t,idx)=>{
          if (idx!=this.lineHover.line_idx) {
            let predictions = this.predictions[classifier][parseFloat(t).toFixed(2)]
            chart.select('.line-threshold-'+idx).attr('opacity',0.2)
            chart.select('.text-threshold-'+idx).attr('opacity',0.2)
            predictions.forEach((c,i)=>{
              chart.select(".dot-"+idx+'-'+i).attr('opacity',0.2)
            })

          }
        })        
      } else {
        tmp_thresholdList.forEach((t,idx)=>{
          let predictions = this.predictions[classifier][parseFloat(t).toFixed(2)]
          chart.select('.line-threshold-'+idx).attr('opacity',1)
          chart.select('.text-threshold-'+idx).attr('opacity',1)
          predictions.forEach((c,i)=>{
              chart.select(".dot-"+idx+'-'+i).attr('opacity',1)
          })
        })     
      }

    },
    drawHover() {
      // @ts-ignore
      const chart = d3.select(this.$refs.svg);
      if (this.hover.info) {
        chart.select('.hover-box').attr('visibility','visible')
        chart.select('.hover-left').attr('visibility','visible').text('Left bound: '+ this.hover.info.left_edge)
        chart.select('.hover-right').attr('visibility','visible').text('Right bound: '+ this.hover.info.right_edge)
        chart.select('.hover-rej').attr('visibility','visible').text('Rej rate: '+ this.hover.info.rejec_rate.toFixed(3))
        chart.select('.hover-acc').attr('visibility','visible')
            .text(this.evaluationKeys == 'c_accuracy'?'Acc(Conditional): '+ this.hover.info.c_acc.toFixed(3)
                 : this.evaluationKeys == 'acc'?'Acc: '+ this.hover.info.acc.toFixed(3)
                 : this.evaluationKeys == 'precision'?'Precision: '+ this.hover.info.precision.toFixed(3) 
                 : this.evaluationKeys == 'recall'?'Recall: '+ this.hover.info.recall.toFixed(3)
                 : this.evaluationKeys == 'mcc'?'MCC: '+ this.hover.info.mcc.toFixed(3)
                 :'F1: '+ this.hover.info.f1.toFixed(3))
      } else {
        chart.select('.hover-box').attr('visibility','hidden')
        chart.select('.hover-left').attr('visibility','hidden')
        chart.select('.hover-right').attr('visibility','hidden')
        chart.select('.hover-acc').attr('visibility','hidden')
        chart.select('.hover-rej').attr('visibility','hidden')
      }
    },

    
    drawWithinInitial() {
      d3.select(this.$refs.svg).selectAll('*').remove();

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


      const legend2 = svg  
          .append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(
              ${(this.width - this.margin.left)},
              ${-this.margin.top})`);

      const thresholdBins =  legend2.append("g")
              .attr("transform",  "translate("+(this.width / 3-200-80)+"," + 0 +")")


      const drawLegend = () => {
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
              (d:string)=>this.numberOfBins = ((this.xScale.invert(d3.event.x) * (20 / 200) ) / 20).toFixed(2)//
              ))
             ;  
          thresholdBins.append('text')
            .attr("class","bin-text")
            .attr("transform",  "translate("+(-100)+"," +0 +")")
            .attr('font-size', '24px')
            .attr('text-anchor', 'middle')
            .attr('alignment-baseline', 'middle')
            .text("Threshold: "+this.numberOfBins)   


          // add button
          thresholdBins.append('rect')
            .attr('width',40)
            .attr('height',20)
            .attr('rx',6)
            .attr('ry',6) 
            .attr("fill","#f2f2f2")
            .attr("stroke","lightgrey")
            .attr('class','add-button')
            .attr('transform', 'translate(210,-7.5)')
            .on('click', (d,i) => this.currentThresholds =  ({threshold: this.tmp_threshold}));
          thresholdBins.append('text')
          .attr("class","add-text")
          .attr("transform",  "translate("+(230)+"," +2 +")")
          .attr('font-size', '18px')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text("add")   
          .attr("fill","grey")
            .on('click', (d,i) => this.currentThresholds = ({threshold: this.tmp_threshold}));
            
        
      };

      const drawHover = () =>{
        thresholdBins.append("rect")
          .attr("class","hover-box")
          .attr("width",240)
          .attr("height",100)
          .attr("x", -this.width + 200)
          .attr("y", -20)
          .attr("fill","white")
          .attr("stroke","black")
          .attr('visibility', 'hidden')
        thresholdBins.append("text")
          .attr("class","hover-left")
          .attr("x", -this.width + 202)
          .attr("y", 0)
          .attr('font-size',20)
          .text('Left bound')
          .attr('visibility', 'hidden')
          
        thresholdBins.append("text")
          .attr("class","hover-right")
          .attr("x", -this.width + 202)
          .attr("y", 20)
          .text('Right bound')
          .attr('font-size',20)
          .attr('visibility', 'hidden')


        thresholdBins.append("text")
          .attr("class","hover-rej")
          .attr("x", -this.width + 202)
          .attr("y", 40)
          .text('Rej Rate')
          .attr('font-size',20)
          .attr('visibility', 'hidden')


        thresholdBins.append("text")
          .attr("class","hover-acc")
          .attr("x", -this.width + 202)
          .attr("y", 60)
          .text('Acc(conditional)')
          .attr('font-size',20)
          .attr('visibility', 'hidden')

          
      }

      drawHover();

     if (this.multilClassifier != 'yes') {
       drawLegend();
     } 
      
    },

    drawStreamChart() {     

      const chart = d3.select(this.$refs.svg);
      const selectedClassifier = this.value.length == 0? '' : this.value[this.value.length - 1].name;
      
      const svg_curves = chart.select(".svg-curve")

      svg_curves.selectAll('*').remove();

      const instances = this.instances;
      const thresholds = this.thresholds;
      const evaluationSelection = this.evaluationKeys;


      
      const evaluationKeys = this.evaluationKeys

      const x = d3.scaleLinear()
          .domain([this.leftRate, this.rightRate])
          .range([0, this.width * 0.9]);

      const y = d3.scaleLinear()
        .domain([evaluationKeys == 'mcc'? -1:0, 1])
        .range([this.height, 0]);

      const classifier = this.value[0].name

      const sequentialScale = d3.scaleSequential<string>( d3.interpolateCool)
            .domain([0, (this.thresholdList.length + 1)*2])
            .interpolator(function (x) { 
              return d3.interpolateCool(0.8*x);} );
      
      let tmp_thresholdList = []
      this.thresholdList.forEach((t)=>{
        tmp_thresholdList.push(t)
      })
      tmp_thresholdList.push(this.tmp_threshold)


      const drawCurves = () =>{
        tmp_thresholdList.forEach((t, idx)=>{
          let predictions = this.predictions[classifier][parseFloat(t).toFixed(2)]
          let mappedPredictions = predictions.filter((n)=>n.rejec_rate >= this.leftRate && n.rejec_rate <= this.rightRate)
          let sortedPredictions = mappedPredictions.sort((n1,n2) => {
              if ( (n1.rejec_rate ) < (n2.rejec_rate)) {
                  return 1;
              }

              if ( (n1.rejec_rate ) > (n2.rejec_rate)) {
                  return -1;
              }

              return 0;
          });    
          if (evaluationKeys == 'mcc') {
            sortedPredictions = sortedPredictions.filter((i)=>i.rejec_rate <= 0.8)
          }
          function line() {
                return d3.line()(sortedPredictions.map(function(p,j) { 
                  let y_value = evaluationKeys == 'c_accuracy'? y(p.c_acc) 
                    : evaluationKeys == 'f1'? y(p.f1)
                    : evaluationKeys == 'precision'? y(p.precision)
                    : evaluationKeys == 'recall'? y(p.recall)
                    : evaluationKeys == 'mcc'? y(p.mcc)
                    : y(p.acc)
                  return [x(p.rejec_rate), y_value]; 
                }));
          }
        
          svg_curves.append("path")
                .attr('class', '')
                .attr("class", "line-threshold-"+idx)
                .attr("d",  line())
                .style("fill", "none")
                .attr("stroke", sequentialScale(idx+1))
                .style("stroke-width", 3)

          svg_curves.selectAll(".dot")
              .data(sortedPredictions)
            .enter().append("circle") // Uses the enter().append() method
              .attr("class",(d,i)=> "dot-"+idx+'-'+i) // Assign a class for styling
              .attr("cx", d=> { return x(d['rejec_rate']) })
              .attr("cy", (d)=> { 
                let y_value = evaluationKeys == 'c_accuracy'? y(d['c_acc']) 
                    : evaluationKeys == 'f1'? y(d['f1'])
                    : evaluationKeys == 'precision'? y(d['precision'])
                    : evaluationKeys == 'recall'? y(d['recall'])
                    : evaluationKeys == 'mcc'? y(d['mcc'])
                    : y(d['acc'])
                return y_value })
              .attr("r", 5)
              .attr('fill', sequentialScale(idx+1))
              .attr('stroke','steelblue')
              .on('mouseenter', (d,i)=>this.hover = ({info: d, idx: i, line_idx: idx}))
              .on('mouseleave', (d,i)=>this.hover = ({info: '', idx: '', line_idx: ''})) 
              .on('click',(d,i)=>this.click = ({'classifier':classifier, 'left_range':d['left_edge'], 'right_range':d['right_edge'] })) 
              .attr("opacity",1);

          // add legend
          svg_curves.append('text')
            .attr('transform', () => {
              const xOffset = this.width - 100;
              const yOffset = this.height + 20 * (idx ) + this.margin.bottom;
              return `translate(${xOffset}, ${yOffset})`;
            })
            .attr("class", "text-threshold-"+idx)
            .style('text-anchor', 'middle')
            .style('font-size', '24px')
            .attr('fill', sequentialScale(idx+1))
            .text('Threshold ' + t)
            .on('mouseenter', ()=>this.lineHover = ({info: '', line_idx: idx}))
            .on('mouseleave', ()=>this.lineHover = ({info: '',  line_idx: ''})) 
            ;
        })
      };


      const drawMultiClassifeirCurves = () =>{
        const sequentialScale = d3.scaleSequential<string>( d3.interpolatePlasma)
            .domain([0, this.classifiers.length])
            .interpolator(function (x) { return d3.interpolatePlasma(.8*x);} );
        this.value.forEach((c, idx)=>{
          let classifier = c.name
          let t =  (Math.floor(this.classifierThresholds[classifier] / 2 ) * 2 / 100).toFixed(2)
          let predictions = this.predictions[classifier][parseFloat(t).toFixed(2)]
          let mappedPredictions = predictions.filter((n)=>n.rejec_rate >= this.leftRate && n.rejec_rate <= this.rightRate)
          let sortedPredictions = mappedPredictions.sort((n1,n2) => {
              if ( (n1.rejec_rate ) < (n2.rejec_rate)) {
                  return 1;
              }

              if ( (n1.rejec_rate ) > (n2.rejec_rate)) {
                  return -1;
              }

              return 0;
          });    
          if (evaluationKeys == 'mcc') {
            sortedPredictions = sortedPredictions.filter((i)=>i.rejec_rate <= 0.8)
          }
          function line() {
                return d3.line()(sortedPredictions.map(function(p,j) { 
                  let y_value = evaluationKeys == 'c_accuracy'? y(p.c_acc) 
                    : evaluationKeys == 'f1'? y(p.f1)
                    : evaluationKeys == 'precision'? y(p.precision)
                    : evaluationKeys == 'recall'? y(p.recall)
                    : evaluationKeys == 'mcc'? y(p.mcc)
                    : y(p.acc)
                  return [x(p.rejec_rate), y_value]; 
                }));
          }
        
          svg_curves.append("path")
                .attr('class', '')
                .attr("class", "line-threshold-"+idx)
                .attr("d",  line())
                .style("fill", "none")
                .attr("stroke", sequentialScale(idx+1))
                .style("stroke-width", 3)
                // .style("opacity", 1)   


          svg_curves.selectAll(".dot")
              .data(sortedPredictions)
            .enter().append("circle") // Uses the enter().append() method
              .attr("class",(d,i)=> "dot-"+idx+'-'+i) // Assign a class for styling
              .attr("cx", d=> { return x(d['rejec_rate']) })
              .attr("cy", (d)=> { 
                let y_value = evaluationKeys == 'c_accuracy'? y(d['c_acc']) 
                    : evaluationKeys == 'f1'? y(d['f1'])
                    : evaluationKeys == 'precision'? y(d['precision'])
                    : evaluationKeys == 'recall'? y(d['recall'])
                    : evaluationKeys == 'mcc'? y(d['mcc'])
                    : y(d['acc'])
                return y_value })
              .attr("r", 5)
              .attr('fill', sequentialScale(idx+1))
              .attr('stroke', sequentialScale(idx+1))
              .on('mouseenter', (d,i)=>this.hover = ({info: d, idx: i, line_idx: idx}))
              .on('mouseleave', (d,i)=>this.hover = ({info: '', idx: '', line_idx: ''}))  
              .on('click',(d,i)=>this.click = ({'classifier':classifier, 'left_range':d['left_edge'], 'right_range':d['right_edge'] })) 
              .attr("opacity",1);

          // add legend
          svg_curves.append('text')
            .attr('transform', () => {
              const xOffset = this.width - 100;
              const yOffset = this.height + 20 * (idx ) + this.margin.bottom;
              return `translate(${xOffset}, ${yOffset})`;
            })
            .attr("class", "text-threshold-"+idx)
            .style('text-anchor', 'middle')
            .style('font-size', '24px')
            .attr('fill', sequentialScale(idx+1))
            .text(classifier)
            .on('mouseenter', ()=>this.lineHover = ({info: '', line_idx: idx}))
            .on('mouseleave', ()=>this.lineHover = ({info: '',  line_idx: ''})) 
            ;
        })
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
          .text('Rejection Rate');

        svg_curves.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('x', -this.height / 1.5)
          .attr('y', -this.margin.left * 0.9)
          .attr('dy', '1em')
          .style('text-anchor', 'middle')
          .style('font-size', '24px')
          .text( evaluationKeys == 'c_accuracy'? 'Conditional Accuracy'
                  : evaluationKeys == 'f1'? 'F1'
                  : evaluationKeys == 'precision'? 'Precision'
                  : evaluationKeys == 'recall'?'Recall'
                  : evaluationKeys == 'mcc'? 'MCC'
                  : 'Accuracy');

        svg_curves.append('text')
          .attr("class","curve-title")
          .attr('x', this.width * 0.4)
          .attr('y', -100)
          .attr('dy', '1em')
          .style('text-anchor', 'middle')
          .style('font-size', '32px')
          .text( this.multilClassifier == 'no' ?'Performance (' + selectedClassifier + ')' : 'Performance');  
      };

      const drawAxes = () => {
        let rated_domain = ["0.00", "0.10","0.20","0.30","0.40","0.50","0.60","0.70","0.80","0.90","1.00"]
        let mapped_rate_domain = rated_domain.filter((i)=>parseFloat(i) >= this.leftRate && parseFloat(i) <= this.rightRate)
        
        let xRates = d3.scaleBand<string>()
          .domain(mapped_rate_domain)
          .range([0, this.width*0.9])

        const xTAxis = (g: any) => g
          .attr('transform', `translate(${0}, ${this.height})`)
          .call(
            d3.axisBottom(xRates)
              .tickSizeOuter(0),
          )
          .attr("class","xAxis-curve");

        svg_curves.append('g')
          .call(xTAxis)
          .attr('font-size', 20)
          .selectAll('text')
          .attr('transform', 'rotate(30)')
          .attr('text-anchor', 'start')
          .on('click', (d:string) => {
            this.leftRate = parseFloat(d).toFixed(2)})
          .on('contextmenu', (d: string) => this.rightRate = parseFloat(d).toFixed(2));

       
        const yTAxis = (g: any) => g
          .call(d3.axisLeft(y)
            .ticks(5)
            .tickFormat(d3.format('.0%')),
          );

        svg_curves.append('g')
          .call(yTAxis)
          .attr('font-size', 20);

        svg_curves.append('rect')
          .attr('width',40)
          .attr('height', 20)
          .attr('x', -this.margin.left + 30)
          .attr('y', this.height)
          .attr('fill','lightgrey')
          .attr('stroke','grey')
          .on('click', (d: string) => {
            this.leftRate = 0
            this.rightRate = 1
            })
        svg_curves.append('text')
          .attr('x', -this.margin.left + 35)
          .attr('y', this.height+15)
          .attr('fill','black')
          .attr('font-size',20)
          .text('set')
          .on('click', (d: string) => {
            this.leftRate = 0
            this.rightRate = 1
            })
      };

      
      drawAxes();
      drawTitles();
      if (this.multilClassifier == 'yes') {
        drawMultiClassifeirCurves();
      } else {
        drawCurves();
      }
            
    },

    drawSelectionChart() {

      const chart = d3.select(this.$refs.svg);
      const selectedClassifier = this.value.length == 0? '' : this.value[this.value.length - 1].name;
      
      const svg_curves = chart.select(".svg-curve")

      svg_curves.selectAll('*').remove();

      const instances = this.instances;
      const thresholds = this.thresholds;
      const evaluationSelection = this.evaluationKeys;
      const evaluationKeys = this.evaluationKeys

      const x = d3.scaleLinear()
          .domain([this.leftRate, this.rightRate])
          .range([0, this.width * 0.9]);

      const y = d3.scaleLinear()
        .domain([evaluationKeys == 'mcc'? -1:0, 1])
        .range([this.height, 0]);

      const {first, second} = this.selections;
      let selectionList = [[...first.instances], [...second.instances]]

      const drawCurves = () =>{
        let t =  (Math.floor(this.classifierThresholds[selectedClassifier] / 2 ) * 2 / 100).toFixed(2)
        let colors = [this.selection1Color, this.selection2Color]
        selectionList.forEach((tmp_selection, idx)=>{
          let classifier = selectedClassifier
          let t =  (Math.floor(this.classifierThresholds[classifier] / 2 ) * 2 / 100).toFixed(2)
          let predictions = this.selectedPred[idx][parseFloat(t).toFixed(2)]
          let mappedPredictions = predictions.filter((n)=>n.rejec_rate >= this.leftRate && n.rejec_rate <= this.rightRate)
          let sortedPredictions = mappedPredictions.sort((n1,n2) => {
              if ( (n1.rejec_rate ) < (n2.rejec_rate)) {
                  return 1;
              }

              if ( (n1.rejec_rate ) > (n2.rejec_rate)) {
                  return -1;
              }

              return 0;
          });    
          if (evaluationKeys == 'mcc') {
            sortedPredictions = sortedPredictions.filter((i)=>i.rejec_rate <= 0.8)
          }
          function line() {
                return d3.line()(sortedPredictions.map(function(p,j) { 
                  let y_value = evaluationKeys == 'c_accuracy'? y(p.c_acc) 
                    : evaluationKeys == 'f1'? y(p.f1)
                    : evaluationKeys == 'precision'? y(p.precision)
                    : evaluationKeys == 'recall'? y(p.recall)
                    : evaluationKeys == 'mcc'? y(p.mcc)
                    : y(p.acc)
                  return [x(p.rejec_rate), y_value]; 
                }));
          }
        
          svg_curves.append("path")
                .attr('class', '')
                .attr("class", "line-threshold-"+idx)
                .attr("d",  line())
                .style("fill", "none")
                .attr("stroke", colors[idx])
                .style("stroke-width", 3)
                // .style("opacity", 1)   


          svg_curves.selectAll(".dot")
              .data(sortedPredictions)
            .enter().append("circle") // Uses the enter().append() method
              .attr("class",(d,i)=> "dot-"+idx+'-'+i) // Assign a class for styling
              .attr("cx", d=> { return x(d['rejec_rate']) })
              .attr("cy", (d)=> { 
                let y_value = evaluationKeys == 'c_accuracy'? y(d['c_acc']) 
                    : evaluationKeys == 'f1'? y(d['f1'])
                    : evaluationKeys == 'precision'? y(d['precision'])
                    : evaluationKeys == 'recall'? y(d['recall'])
                    : evaluationKeys == 'mcc'? y(d['mcc'])
                    : y(d['acc'])
                return y_value })
              .attr("r", 5)
              .attr('fill', colors[idx])
              .attr('stroke', colors[idx])
              .on('mouseenter', (d,i)=>this.hover = ({info: d, idx: i, line_idx: idx}))
              .on('mouseleave', (d,i)=>this.hover = ({info: '', idx: '', line_idx: ''}))  
              .on('click',(d,i)=>this.click = ({'classifier':classifier, 'left_range':d['left_edge'], 'right_range':d['right_edge'] })) 
              .attr("opacity",1);

          // add legend
          svg_curves.append('text')
            .attr('transform', () => {
              const xOffset = this.width - 100;
              const yOffset = this.height + 20 * (idx ) + this.margin.bottom;
              return `translate(${xOffset}, ${yOffset})`;
            })
            .attr("class", "text-threshold-"+idx)
            .style('text-anchor', 'middle')
            .style('font-size', '24px')
            .attr('fill', colors[idx])
            .text('Selection'+(idx+1))
            .on('mouseenter', ()=>this.lineHover = ({info: '', line_idx: idx}))
            .on('mouseleave', ()=>this.lineHover = ({info: '',  line_idx: ''})) 
            ;
        })

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
          .text('Rejection Rate');

        svg_curves.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('x', -this.height / 1.5)
          .attr('y', -this.margin.left * 0.9)
          .attr('dy', '1em')
          .style('text-anchor', 'middle')
          .style('font-size', '24px')
          .text( evaluationKeys == 'c_accuracy'? 'Conditional Accuracy'
                  : evaluationKeys == 'f1'? 'F1'
                  : evaluationKeys == 'precision'? 'Precision'
                  : evaluationKeys == 'recall'?'Recall'
                  : evaluationKeys == 'mcc'? 'MCC'
                  : 'Accuracy');

        svg_curves.append('text')
          .attr("class","curve-title")
          .attr('x', this.width * 0.4)
          .attr('y', -100)
          .attr('dy', '1em')
          .style('text-anchor', 'middle')
          .style('font-size', '32px')
          .text( this.multilClassifier == 'no' ?'Performance (' + selectedClassifier + ')' : this.selection_mode == 'selected'? 'Performance (' + selectedClassifier + ')': 'Performance');  
      };

      const drawAxes = () => {
        let rated_domain = ["0.00", "0.10","0.20","0.30","0.40","0.50","0.60","0.70","0.80","0.90","1.00"]
        let mapped_rate_domain = rated_domain.filter((i)=>parseFloat(i) >= this.leftRate && parseFloat(i) <= this.rightRate)
        
        let xRates = d3.scaleBand<string>()
          .domain(mapped_rate_domain)
          .range([0, this.width*0.9])

        const xTAxis = (g: any) => g
          .attr('transform', `translate(${0}, ${this.height})`)
          .call(
            d3.axisBottom(xRates)
              .tickSizeOuter(0),
          )
          .attr("class","xAxis-curve");

        svg_curves.append('g')
          .call(xTAxis)
          .attr('font-size', 20)
          .selectAll('text')
          .attr('transform', 'rotate(30)')
          .attr('text-anchor', 'start')
          .on('click', (d:string) => {
            this.leftRate = parseFloat(d).toFixed(2)})
          .on('contextmenu', (d: string) => this.rightRate = parseFloat(d).toFixed(2));
        const yTAxis = (g: any) => g
          .call(d3.axisLeft(y)
            .ticks(5)
            .tickFormat(d3.format('.0%')),
          );

        svg_curves.append('g')
          .call(yTAxis)
          .attr('font-size', 20);

        svg_curves.append('rect')
          .attr('width',40)
          .attr('height', 20)
          .attr('x', -this.margin.left + 30)
          .attr('y', this.height)
          .attr('fill','lightgrey')
          .attr('stroke','grey')
          .on('click', (d: string) => {
            this.leftRate = 0
            this.rightRate = 1
            })
        svg_curves.append('text')
          .attr('x', -this.margin.left + 35)
          .attr('y', this.height+15)
          .attr('fill','black')
          .attr('font-size',20)
          .text('set')
          .on('click', (d: string) => {
            this.leftRate = 0
            this.rightRate = 1
            })
      };

      
      drawAxes();
      drawTitles();
      drawCurves();

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
