<template>
  <div class="database-management">

    <div class="card stats-card">
      <div class="card-header">
        <div v-if="state !== 5" class="plan-controlEs">
          <input type="checkbox" v-model="editableEnabled"><label>🖊</label>
        </div>
        <h2 class="card-title">{{ date }} Daily Report</h2>
      </div>

      <!-- STATUS -->
      <div v-if="state === 5" class="status-ribbon accepted">Aproved</div>
      <div v-if="state === 2" class="status-ribbon pending">Awaiting</div>
      <div v-if="[3,4].includes(state)" class="status-ribbon rejected">Rejected</div>

      <div v-if="report">

        <div class="stats-grid">

          <div
            v-for="(section, index) in report.sections"
            :key="index"
          >
            <h2 
              class="card-subtitle"
              :contenteditable="isEditable"
              @dblclick="$event.target.focus()"
              @blur="handleTitleInput($event, index)"
              >
              {{ section.title }}
            </h2>

            <div class="editor-wrapper">

              <!-- TOOLBAR -->
              <div
                class="toolbar"
                :class="{ active: activeToolbar === index }"
              >
                <button @click="format('bold')"><b>B</b></button>
                <button @click="format('italic')"><i>I</i></button>
                <button @click="format('underline')"><u>U</u></button>

                <!-- <select @change="applyBlockFormat($event.target.value)">
                  <option value="">Style</option>
                  <option value="p">Paragraph</option>
                  <option value="h1">Heading 1</option>
                  <option value="h2">Heading 2</option>
                  <option value="h3">Heading 3</option>
                </select> -->

                <select @change="format('fontName', $event.target.value)">
                  <option value="">Font</option>
                  <option value="Arial">Arial</option>
                  <option value="Verdana">Verdana</option>
                  <option value="Tahoma">Tahoma</option>
                  <option value="Trebuchet MS">Trebuchet MS</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Lucida Console">Lucida Console</option>
                  <option value="Impact">Impact</option>
                </select>

                <select @change="format('fontSize', $event.target.value)">
                  <option value="">Size</option>
                  <option value="3">16px</option>
                  <option value="4">18px</option>
                  <option value="5">24px</option>
                  <option value="6">32px</option>
                </select>


                <input type="color" @input="format('foreColor', $event.target.value)">
                <input type="color" @input="format('hiliteColor', $event.target.value)">
              </div>

              <!-- EDITOR -->
              <div
                class="editor"
                :contenteditable="isEditable"
                :ref="el => setEditorRef(el, index)"
                @focus="handleFocus(index)"
                @input="handleInput($event, index)"
                @keydown="handleKeyDown($event, index)"
              ></div>

            </div>
          </div>

        </div>

        <!-- ACTIONS -->
        <div v-if="showActions" class="stats-total">
          <div class="plan-controls">
            <button 
              class="btn-add-plan"
              @click="addPlanEditor">
              +
            </button>

            <button 
              class="btn-remove-plan"
              @click="removePlanEditor"
              >
              -
            </button>
          </div>
          <button @click="loadReport" class="btn-secondary btn-sm">Reload</button>
          <button @click="saveReport" class="btn-danger btn-sm">Reject</button>
          <button @click="submitReport" class="btn-success btn-sm">Aprove</button>
        </div>

      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, computed, watch } from "vue"
import { useAuthStore } from "../stores/auth"
import { updateDaily, getTeam, getAll } from "../services/daily"
import { useToast } from "vue-toastification"


const toast = useToast()
const authStore = useAuthStore()

const report = ref(null)
const editorRefs = ref([])
const editorsContent = ref([])

const activeToolbar = ref("")
const state = ref(0)

const selectedEditor = ref(0)

const date = ref(new Date().toLocaleDateString("en-CA"))


/* =====================
   COMPUTED
===================== */
const editableEnabled = ref(false)

const showActions = computed(() => editableEnabled.value)
const isEditable = computed(() => editableEnabled.value)
// const isEditable = computed(() =>
//   [2,3,4].includes(state.value) || editableEnabled.value
// )

function handleTitleInput(e, index) {  
  report.value.sections[index].title = e.target.innerText
}

const STORAGE_KEY = `daily_titles_${authStore.user.id}`

function saveTitlesToStorage(){
  if(!report.value) return

  const titles = report.value.sections.map( s => s.title )
  localStorage.setItem(STORAGE_KEY, JSON.stringify(titles))
  // console.log(titles)
}


function addPlanEditor() {
  if (!report.value?.sections) return
  report.value.sections.push({
    title: "Plan",
    notes: ""
  })
}

function removePlanEditor() {
  if (!report.value?.sections) return
  report.value.sections = report.value.sections.filter(
    section => section.title !== selectedEditor.value
  )
}

function placeCaretAtEnd(el) {
  el.focus()
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  const sel = window.getSelection()
  sel.removeAllRanges()
  sel.addRange(range)
}
function handleKeyDown(e, index) {

  /* ================= TAB HANDLING ================= */

  if (e.key === "Tab") {
    e.preventDefault()

    const selection = window.getSelection()
    const range = selection.getRangeAt(0)

    // If inside list → indent/outdent like Word
    const li = getClosest(range.startContainer, "LI")

    if (li) {
      if (e.shiftKey) {
        document.execCommand("outdent")
      } else {
        document.execCommand("indent")
      }
      return
    }

    // Normal paragraph → insert real tab spacing
    document.execCommand("insertHTML", false, "&nbsp;&nbsp;&nbsp;&nbsp;")
    return
  }

  /* ================= ENTER AUTO FORMAT ================= */

  if (e.key === "Enter") {
    handleAutoFormat(e, index)
  }
}
function getClosest(node, tag) {
  while (node) {
    if (node.nodeType === 1 && node.tagName === tag) return node
    node = node.parentNode
  }
  return null
}
function convertBlock(block, tag) {
  const newBlock = document.createElement(tag)
  newBlock.innerHTML = block.innerHTML
  block.parentNode.replaceChild(newBlock, block)
  placeCaretAtEnd(newBlock)
}
function handleAutoFormat(e, index) {
  
  const selection = window.getSelection()
  console.log(selection)
  if (!selection.rangeCount) return

  const range = selection.getRangeAt(0)
  console.log(range)
  const block = getClosest(range.startContainer, "P") 
              || getClosest(range.startContainer, "DIV")
              || getClosest(range.startContainer, "LI")
  console.log(block)
  if (!block) return

  const text = block.innerText.trim()
  console.log(text)
  /* ---------- HEADINGS ---------- */


  if (block.tagName === "LI" && block.innerText.trim() === "") {
    e.preventDefault()
    document.execCommand("outdent")
    document.execCommand("insertParagraph")
    return
  }

  if (text.startsWith("# ")) {
    e.preventDefault()
    block.innerText = text.replace("# ", "")
    convertBlock(block, "h1")
    return
  }

  if (text.startsWith("## ")) {
    e.preventDefault()
    block.innerText = text.replace("## ", "")
    convertBlock(block, "h2")
    return
  }

  if (text.startsWith("### ")) {
    e.preventDefault()
    block.innerText = text.replace("### ", "")
    convertBlock(block, "h3")
    return
  }

  /* ---------- NUMBER LIST ---------- */

  if (/^\d+\.\s/.test(text)) {
    e.preventDefault()
    block.innerText = text.replace(/^\d+\.\s/, "")
    document.execCommand("insertOrderedList")
    return
  }

  /* ---------- BULLET LIST ---------- */

  if (/^(\*|-)\s/.test(text)) {
    e.preventDefault()
    block.innerText = text.replace(/^(\*|-)\s/, "")

    const insideOrdered = getClosest(block, "OL")

    if (insideOrdered) {
      // If inside numbered list → create nested UL
      document.execCommand("insertUnorderedList")
      document.execCommand("indent")
    } else {
      document.execCommand("insertUnorderedList")
    }

    return
  }
}




/* =====================
   EDITOR CORE
===================== */

function setEditorRef(el, index) {
  if (el) editorRefs.value[index] = el
}

function handleFocus(index) {
  if (!isEditable.value) return
  activeToolbar.value = index
  selectedEditor.value = report.value.sections[index].title
}

function handleInput(e, index) {
  editorsContent.value[index] = e.target.innerHTML
}

function format(command, value = null) {
  document.execCommand(command, false, value)
}

/* =====================
   LOAD REPORT
===================== */
const props = defineProps({
  p_id: {
    type: String
  }
});
const selectedR = ref({});


async function loadReport() {
  try {
    console.log(authStore.user.group)
    const response = await getAll()

    console.log(response)

    if(response.data){        
        let selectedReport = null;
        if (props.p_id && props.p_id !== '') {
            selectedReport = response.data.find(item => item._id === props.p_id);
            selectedR.value = selectedReport;
        }
        else {
            selectedReport = response.data.find(item => item.date.split("T")[0] === date.value && item.state > 4);
        }
        report.value = selectedReport
        state.value = selectedReport.state
        editorsContent.value = selectedReport.sections.map(s => s.notes || "")

        await nextTick()

        editorsContent.value.forEach((content, i) => {
            if (editorRefs.value[i]) {
                editorRefs.value[i].innerHTML = content
            }
        })
    }
  } catch (err) {
    toast.error("Failed to load report")
  }
}

/* =====================
   SAVE
===================== */

async function saveReport() {
  try {

    const updatedSections = report.value.sections.map((section, index) => ({
      ...section,
      notes: editorsContent.value[index]
    }))

    await updateDaily(
      selectedR.value.userId,
      selectedR.value.username,
      selectedR.value.group,
      selectedR.value.date,
      {
        sections: updatedSections,
        state: 3
      }
    )

    toast.success("Rejected Successfully")
    loadReport()

  } catch {
    toast.error("Reject Failed")
  }
}

/* =====================
   SUBMIT
===================== */

async function submitReport() {
  try {

    const updatedSections = report.value.sections.map((section, index) => ({
      ...section,
      notes: editorsContent.value[index]
    }))

    await updateDaily(
      selectedR.value.userId,
      selectedR.value.username,
      selectedR.value.group,
      selectedR.value.date,
      {
        sections: updatedSections,
        state: 5
      }
    )

    toast.success("Submitted Successfully")
    loadReport()

  } catch {
    toast.error("Submit Failed")
  }
}

onMounted(() => {
  watch(
  () => props.p_id,
  (newVal) => {
    loadReport();   // reload when id changes
  }
  );
  loadReport();

});

</script>

<style scoped>
.database-management {
  /* padding: var(--spacing-xl); */
  min-width: 60%;
  margin: 0 auto;
}

.page-header {
  margin-bottom: var(--spacing-2xl);
}

.page-header h1 {
  font-size: var(--font-size-4xl);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-sm);
}

.subtitle {
  color: var(--text-secondary);
  font-size: var(--font-size-base);
}

.card {
  background: var(--bg-primary);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-light);
  padding: var(--spacing-xl);
  margin-bottom: var(--spacing-xl);
}

.card-header {
  /* display: flex;
  justify-content: space-between; */
  position: relative;
  overflow: hidden;
  text-align: center;
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-md);
  border-bottom: 2px solid var(--border-light);
}

.card-title {
  font-size: var(--font-size-4xl);
  font-weight: var(--font-weight-bold);
  /* color: var(--text-primary); */
  margin: 0;
}
.card-subtitle {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin-left: 60px;
}

.card-content {
  margin-top: var(--spacing-lg);
}

.description {
  color: var(--text-secondary);
  margin-bottom: var(--spacing-lg);
  line-height: var(--line-height-relaxed);
}

.description.warning {
  color: var(--color-error);
  background: rgba(239, 68, 68, 0.1);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  border-left: 4px solid var(--color-error);
}

/* Stats */
.stats-grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.stat-item {
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
}

.stat-label {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin-bottom: var(--spacing-xs);
  font-weight: var(--font-weight-medium);
}

.stat-value {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
}

.stats-total {
  padding-top: var(--spacing-md);
  border-top: 2px solid var(--border-light);
  text-align: center;
  font-size: var(--font-size-lg);
  color: var(--text-primary);
}

/* File Upload */
.file-upload-area {
  border: 2px dashed var(--border-medium);
  border-radius: var(--radius-lg);
  padding: var(--spacing-2xl);
  text-align: center;
  cursor: pointer;
  transition: all var(--transition-base);
  margin-bottom: var(--spacing-lg);
  background: var(--bg-secondary);
}

.file-upload-area:hover,
.file-upload-area.dragover {
  border-color: var(--color-primary);
  background: rgba(99, 102, 241, 0.05);
}

.upload-placeholder {
  color: var(--text-secondary);
}

.upload-hint {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  margin-top: var(--spacing-xs);
}

.file-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
}

.file-name {
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

/* Import Results */
.import-results {
  margin-top: var(--spacing-lg);
  padding: var(--spacing-lg);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.import-results h3 {
  font-size: var(--font-size-lg);
  margin-bottom: var(--spacing-md);
  color: var(--text-primary);
}

.results-grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.result-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
}

.collection-name {
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  min-width: 150px;
}

.result-badge {
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.result-badge.success {
  background: rgba(16, 185, 129, 0.1);
  color: var(--color-success);
}

.result-badge.warning {
  background: rgba(245, 158, 11, 0.1);
  color: var(--color-warning);
}

.result-badge.error {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-error);
}

.error-message {
  margin-top: var(--spacing-md);
  padding: var(--spacing-md);
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-error);
  border-radius: var(--radius-md);
  border-left: 4px solid var(--color-error);
}

.success-message {
  margin-top: var(--spacing-md);
  padding: var(--spacing-md);
  background: rgba(16, 185, 129, 0.1);
  color: var(--color-success);
  border-radius: var(--radius-md);
  border-left: 4px solid var(--color-success);
}

.loading-state {
  text-align: center;
  padding: var(--spacing-xl);
}

.spinner {
  border: 3px solid var(--border-light);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 0.8s linear infinite;
  margin: 0 auto var(--spacing-md);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.btn-sm {
  margin-left: 100px;
  margin-right: 100px;
  padding: 0.5rem 1rem;
  font-size: var(--font-size-md);
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
  
  .result-item {
    flex-direction: column;
    align-items: flex-start;
  }
}


.editor-wrapper {
    background: var(--bg-primary);
    width: 100%;
    position: relative;
}

.toolbar {
    position: absolute;
    bottom: 20px;
    left: 60%;
    right: 10%;
    background: rgba(255, 255, 255, 0.363);
    padding: 5px;
    border-radius: 8px;
    box-shadow: 0 6px 17px rgba(0, 0, 0, 0.1);
    display: flex;
    gap: 8px;
    align-items: center;
    opacity: 0  ;
    transform: translateY(-10px);
    transition: all 0.2s ease;
    pointer-events: none;
}

.toolbar.active {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
}

.toolbar button {
    border: none;
    background: #f3f4f6;
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
}

.toolbar button:hover {
    background: #e5e7eb;
}

.toolbar select,
.toolbar input[type="color"] {
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 5px;
}

.editor {
    background: white;
    min-height: 160px;
    padding: 30px;
    outline: none;
    font-size: 18px;
    line-height: 1.6;
}
/* .editor:hover {
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
} */
.editor:empty:before {
    content: "...";
    color: #aaa;
}
.editor {
  white-space: pre-wrap;
  tab-size:6; /* controls visual tab width */
}

/* Ribbon Base */
.status-ribbon {
  position: absolute;
  top: 20px;
  right: -50px;
  transform: rotate(45deg);
  width: 200px;
  text-align: center;
  padding: 8px 0;
  font-weight: bold;
  color: white;
  font-size: 18px;
  letter-spacing: 1px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
}

/* Accepted Style */
.status-ribbon.accepted {
  background: #22c55e; /* green */
}
.status-ribbon.pending {
  background: #2e85e7; /* green */
}
.status-ribbon.rejected {
  background: #b62525; /* green */
}
.plan-controls {
  display: flex;
  gap: 10px;  
}
.plan-controlEs {
  display: flex;
  gap: 10px;
  position: relative;
  bottom: -50px;
  left: 40px;
}
.btn-add-plan,
.btn-remove-plan {
  padding: 8px 16px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 14px;
  border: none;
  cursor: pointer;
  transition: all 0.25s ease;
}

/* Add Button */
.btn-add-plan {
  background: linear-gradient(135deg, #4CAF50, #2ecc71);
  color: white;
  box-shadow: 0 4px 10px rgba(46, 204, 113, 0.4);
}

.btn-add-plan:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(46, 204, 113, 0.6);
}

/* Remove Button */
.btn-remove-plan {
  background: linear-gradient(135deg, #ff5f6d, #ff3e55);
  color: white;
  box-shadow: 0 4px 10px rgba(255, 62, 85, 0.4);
}

.btn-remove-plan:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(255, 62, 85, 0.6);
}
</style>

