<template>
  <div class="card">
    <v-expansion-panels v-model="panel">
      <v-expansion-panel>
        <v-expansion-panel-content>
          <v-btn
            id="all-instance"
            @click="allInstance"
            v-bind:color="subset === 'all' ? 'primary' : 'firstColor'"
            small
            class="button-panel"
            >All</v-btn
          >
          <v-btn
            id="first-instance"
            @click="firstInstance"
            v-bind:color="subset === 'first' ? 'primary' : 'firstColor'"
            small
            class="button-panel"
            >Selection 1</v-btn
          >
          <v-btn
            id="second-instance"
            @click="secondInstance"
            v-bind:color="subset === 'second' ? 'primary' : 'firstColor'"
            small
            class="button-panel"
            >Selection 2</v-btn
          >
          <v-btn
            id="intersection-instance"
            @click="intersectionInstance"
            v-bind:color="subset === 'intersection' ? 'primary' : 'firstColor'"
            small
            class="button-panel"
            >Intersection</v-btn
          >
          <v-btn
            id="union-instance"
            @click="unionInstance"
            v-bind:color="subset === 'union' ? 'primary' : 'firstColor'"
            small
            class="button-panel"
            >Union</v-btn
          >
          <v-btn
            id="complement-instance"
            @click="complementInstance"
            v-bind:color="subset === 'complement' ? 'primary' : 'firstColor'"
            small
            class="button-panel"
            >Complement of 1 Union 2</v-btn
          >
        </v-expansion-panel-content>
      </v-expansion-panel>
    </v-expansion-panels>
    <v-list id="item-container">
      <v-btn @click="prevInstance(instances)" small class="button-nav"
        >Previous</v-btn
      >
      <v-btn @click="nextInstance(instances)" small class="button-nav"
        >Next</v-btn
      >
      <v-btn @click="randInstance(instances)" small class="button-nav"
        >Random</v-btn
      >
      <v-btn @click="emphasize" color="primary" small class="button-nav"
        >Emphasize</v-btn
      >


        <!-- :max-width="imageDimensions(focus(instances).features.image)[0]"
        :max-height="imageDimensions(focus(instances).features.image)[1]" -->

      <v-img
        contain
        v-if="focus(instances).features.image"
        :src="focus(instances).features.image"
      />
      <v-list-item
        id="v-for-object"
        v-for="(value, name) in focus(instances)"
        :key="value.id"
      >
        <v-list-item-content>
          <v-list-item-subtitle>{{ name }}</v-list-item-subtitle>
          <template v-if="typeof value === 'object'">
            <v-list id="v-for-object" v-for="(v, n) in value" :key="n">
              {{ n }}: {{ v }}
            </v-list>
          </template>
          <template v-else>{{value}}</template>
        </v-list-item-content>
      </v-list-item>

      <v-btn @click="prevInstance(instances)" small class="button-nav"
        >Previous</v-btn
      >
      <v-btn @click="nextInstance(instances)" small class="button-nav"
        >Next</v-btn
      >
      <v-btn @click="randInstance(instances)" small class="button-nav"
        >Random</v-btn
      >
      <v-btn @click="emphasize" color="primary" small class="button-nav"
        >Emphasize</v-btn
      >
      <!-- <v-btn @click="pilot" color="primary" small class="button-nav"
        >pilot</v-btn
      > -->
    </v-list>
  </div>
</template>

<script lang="ts">
import { colors } from "../../theme";
import {
  Instance,
  InstanceWithId,
  SelectionRecord,
  BoxProps,
} from "../../types";
import { instanceById } from "../../utils";
import Vue from "vue";
import { mapActions } from "vuex";
import { isConstraintComplete } from "../constraints/utils";

interface Header {
  text: string;
  value: string;
}

export default Vue.extend({
  name: "InstanceList",
  data() {
    return {
      panel: [],
      sortby: [],
      sortBySel: "" as "" | "first" | "second" | "common",
      descending: false,
      show_predictions: true,
      show_features: true,
      string_length: 7,
      currentIndex: 0,
      subset: "all",
    };
  },
  mounted() {
    this.$store.dispatch("setFocusItem", this.instances[this.currentIndex].id);
    this.$store.dispatch("changeFocusSet", this.subset);
  },
  computed: {
    instances(): InstanceWithId[] {
      let instances: InstanceWithId[] = [];

      this.$store.getters.filteredInstances.forEach((id: string) => {
        const i = instanceById(id);
        const instance: InstanceWithId = {
          id,
          ...i,
        };
        instances.push(instance);
      });

      // get subset depending on the button clicked
      const { first, second } = this.selections;

      if (this.subset !== "all") {
        let selection = [];
        if (this.subset === "first") {
          if (first)
            for (const id of first.instances)
              selection.push(instances.find((x) => x.id === id));
          else {
            this.currentIndex = -1;
            alert("no selection");
          }
        } else if (this.subset === "second") {
          if (second)
            for (const id of second.instances)
              selection.push(instances.find((x) => x.id === id));
          else {
            this.currentIndex = -1;
            alert("no second set of selection");
          }
        } else if (first && second) {
          if (this.subset === "intersection") {
            for (const id of first.instances) {
              if (second.instances.has(id)) {
                // console.log(id);
                selection.push(instances.find((x) => x.id === id));
              }
            }
          } else if (this.subset === "union") {
            for (const id of first.instances)
              selection.push(instances.find((x) => x.id === id));
            for (const id of second.instances)
              if (!first.instances.has(id))
                selection.push(instances.find((x) => x.id === id));
          } else if (this.subset === "complement") {
            for (const instance of instances) {
              if (
                !first.instances.has(instance.id) &&
                !second.instances.has(instance.id)
              )
                selection.push(instance);
            }
          }
        } else {
          this.currentIndex = -1;
          alert("two selected sets are required to perform this action");
        }
        return selection;
      }
      return instances;
    },

    selections(): {
      first: SelectionRecord | null;
      second: SelectionRecord | null;
    } {
      return this.$store.state.overlapSelections;
    },
  },
  watch: {
    currentIndex() {
      this.$store.dispatch(
        "setFocusItem",
        this.currentIndex < 0 ? null : this.instances[this.currentIndex].id
      );
    },
    selections() {
      this.$store.dispatch(
        "setFocusItem",
        this.currentIndex < 0 ? null : this.instances[this.currentIndex].id
      );
    },
    onClose() {
      console.log("focus closed");
    },
  },
  methods: {
    // ...mapActions(["updateHoverInstance", "clearHoverInstance"]),
    // shorten(feature) {
    //   let stringFeature = "" + feature;
    //   if (stringFeature.length > this.string_length) {
    //     return stringFeature.substring(0, this.string_length) + "...";
    //   } else {
    //     return stringFeature;
    //   }
    // },
    /*
      Focus object getter
    */
    focus(instances) {
      // console.log(instances[this.currentIndex])
      return instances[this.currentIndex];
    },
    imageDimensions(url){
      const scale = 4
      console.log(url)
      if(url){
        const image = new Image()
        image.src = url
        console.log(image.width, image.height)
        return [image.width*scale, image.height*scale]
      }
      else{
        return [Infinity,Infinity]
      }
    },

    /*
      Navigation button handlers.
    */
    prevInstance(instances) {
      if (this.currentIndex > 0) this.currentIndex--;
      else this.currentIndex = instances.length - 1;
    },
    nextInstance(instances) {
      if (this.currentIndex < instances.length - 1) this.currentIndex++;
      else this.currentIndex = 0;
    },
    randInstance(instances) {
      this.currentIndex = Math.floor(Math.random() * instances.length);
    },
    /*
      Expanded panel button handlers.
      Handles subset selection.
    */
    allInstance() {
      this.currentIndex = 0;
      this.subset = "all";
      this.$store.dispatch("changeFocusSet", this.subset);
      this.$store.dispatch(
        "setFocusItem",
        this.instances[this.currentIndex].id
      );
    },
    firstInstance() {
      this.currentIndex = 0;
      this.subset = "first";
      this.$store.dispatch("changeFocusSet", this.subset);
      this.$store.dispatch(
        "setFocusItem",
        this.instances[this.currentIndex].id
      );
    },
    secondInstance() {
      this.currentIndex = 0;
      this.subset = "second";
      this.$store.dispatch("changeFocusSet", this.subset);
      this.$store.dispatch(
        "setFocusItem",
        this.instances[this.currentIndex].id
      );
    },
    intersectionInstance() {
      this.currentIndex = 0;
      this.subset = "intersection";
      this.$store.dispatch("changeFocusSet", this.subset);
      this.$store.dispatch(
        "setFocusItem",
        this.instances[this.currentIndex].id
      );
    },
    unionInstance() {
      this.currentIndex = 0;
      this.subset = "union";
      this.$store.dispatch("changeFocusSet", this.subset);
      this.$store.dispatch(
        "setFocusItem",
        this.instances[this.currentIndex].id
      );
    },
    complementInstance() {
      this.currentIndex = 0;
      this.subset = "complement";
      this.$store.dispatch("changeFocusSet", this.subset);
      this.$store.dispatch(
        "setFocusItem",
        this.instances[this.currentIndex].id
      );
    },
    emphasize() {
      this.$store.dispatch("emphasizeFocus");
      

    },
    // pilot() {
    //   console.log(
    //     "first",
    //     this.selections.first ? this.selections.first.instances : "null"
    //   );
    //   console.log(
    //     "second",
    //     this.selections.second ? this.selections.second.instances : "null"
    //   );
    // },
  },
});
</script>

<style scoped>
tr.hover-instance td {
  background-color: yellow;
}
.button-nav {
  /* margin: 20px; */
}
.button-panel {
  /* margin: 5px; */
}
.card {
  background-color: white;
}
#v-for-object {
  /* margin: 10px;
  padding-top: 10px; */
  font-size: 12pt;
}
</style>
