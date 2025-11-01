<template>
    <div class="card relative">
        <!-- Error Banner (if error occurs) -->
        <div
            v-if="hasError"
            class="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg animate-pulse-once"
        >
            <div class="flex items-start">
                <div class="flex-shrink-0">
                    <svg
                        class="h-5 w-5 text-red-500"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path
                            fill-rule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clip-rule="evenodd"
                        />
                    </svg>
                </div>
                <div class="ml-3 flex-1">
                    <h3 class="text-sm font-medium text-red-800">An error occurred</h3>
                    <p class="mt-1 text-sm text-red-700">{{ errorMessage }}</p>
                </div>
                <div class="ml-3">
                    <button
                        @click="dismissError"
                        class="inline-flex rounded-md bg-red-50 p-1.5 text-red-500 hover:bg-red-100 focus:outline-none"
                    >
                        <span class="sr-only">Dismiss</span>
                        <svg
                            class="h-5 w-5"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                        >
                            <path
                                fill-rule="evenodd"
                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                clip-rule="evenodd"
                            />
                        </svg>
                    </button>
                </div>
            </div>
        </div>

        <div class="flex items-center justify-between mb-6">
            <div>
                <h2 class="text-2xl font-semibold text-gray-900">
                    {{ completed ? 'Generation Complete' : 'Generating Documentation' }}
                </h2>
                <!-- Timer -->
                <div class="text-sm text-gray-600 mt-1">⏱️ Elapsed time: {{ elapsedTime }}</div>
            </div>
            <button
                v-if="completed"
                @click="$emit('reset')"
                class="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
                Start New Generation
            </button>
        </div>

        <!-- Status Summary -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div class="bg-primary-50 rounded-lg p-4">
                <div class="text-sm font-medium text-primary-900 mb-1">Reasoning Steps</div>
                <div class="text-2xl font-bold text-primary-700">{{ stats.reasoning }}</div>
            </div>
            <div class="bg-green-50 rounded-lg p-4">
                <div class="text-sm font-medium text-green-900 mb-1">Actions Taken</div>
                <div class="text-2xl font-bold text-green-700">{{ stats.actions }}</div>
            </div>
        </div>

        <!-- Collection JSON Display -->
        <div v-if="completed && collectionJson" class="mb-6">
            <div class="flex items-center justify-between mb-3">
                <h3 class="text-lg font-semibold text-gray-900">📦 Generated Collection</h3>
                <button @click="copyCollection" class="btn btn-primary text-sm px-4 py-2">
                    {{ copied ? '✓ Copied!' : '📋 Copy JSON' }}
                </button>
            </div>
            <div class="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
                <pre class="text-green-400 text-xs font-mono">{{ formatJson(collectionJson) }}</pre>
            </div>
        </div>

        <!-- Main Content: Screenshot and Events Side-by-Side -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <!-- Screenshot Preview -->
            <div v-if="currentScreenshot && isGenerating">
                <h3 class="text-lg font-semibold text-gray-900 mb-3">📸 Current Page</h3>
                <div class="bg-gray-100 rounded-lg p-4 sticky top-4">
                    <img
                        :src="currentScreenshot"
                        alt="Current page screenshot"
                        class="w-full h-auto rounded shadow-lg"
                    />
                </div>
            </div>

            <!-- Event Stream -->
            <div :class="currentScreenshot && isGenerating ? '' : 'lg:col-span-2'">
                <h3 class="text-lg font-semibold text-gray-900 mb-3">📋 Activity Log</h3>
                <div class="space-y-3 max-h-[600px] overflow-y-auto">
                    <TransitionGroup name="slide-fade">
                        <div
                            v-for="event in displayEvents"
                            :key="event.id"
                            class="border-l-4 pl-4 py-3 rounded-r-lg transition-all duration-300"
                            :class="getEventStyle(event.type)"
                        >
                            <div class="flex items-start justify-between">
                                <div class="flex-1">
                                    <div class="flex items-center gap-2 mb-1">
                                        <span
                                            class="font-semibold text-sm"
                                            :class="getEventTextColor(event.type)"
                                        >
                                            {{ getEventIcon(event.type) }}
                                            {{ getEventTitle(event.type) }}
                                        </span>
                                        <span class="text-xs text-gray-500">
                                            {{ formatTimestamp(event.timestamp) }}
                                        </span>
                                    </div>

                                    <div class="text-sm text-gray-700">
                                        <div v-if="event.type === 'reasoning'" class="italic">
                                            "{{ event.data.summary }}"
                                        </div>

                                        <div
                                            v-else-if="event.type === 'action'"
                                            class="font-mono text-xs bg-gray-50 p-2 rounded mt-1"
                                        >
                                            <div class="font-semibold text-gray-900 mb-1">
                                                Action #{{ event.data.count }}
                                            </div>
                                            <pre class="whitespace-pre-wrap">{{
                                                formatActionDetails(event.data.action)
                                            }}</pre>
                                        </div>

                                        <div
                                            v-else-if="event.type === 'started'"
                                            class="text-green-700"
                                        >
                                            Starting browser automation for documentation
                                            extraction...
                                        </div>

                                        <div
                                            v-else-if="event.type === 'complete'"
                                            class="text-green-700 font-medium"
                                        >
                                            ✓ Documentation generation completed successfully!
                                            <div v-if="event.data.message" class="text-sm mt-1">
                                                {{ event.data.message }}
                                            </div>
                                        </div>

                                        <div
                                            v-else-if="event.type === 'screenshot'"
                                            class="text-blue-700"
                                        >
                                            📸 Screenshot captured
                                        </div>

                                        <div
                                            v-else-if="
                                                event.type === 'collection_generation_started'
                                            "
                                            class="text-purple-700"
                                        >
                                            🔧 {{ event.data.message }}
                                        </div>

                                        <div
                                            v-else-if="event.type === 'collection'"
                                            class="text-emerald-700 font-medium"
                                        >
                                            📦 Postman collection generated successfully!
                                        </div>

                                        <div
                                            v-else-if="event.type === 'error'"
                                            class="text-red-700"
                                        >
                                            {{ event.data.message }}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TransitionGroup>
                </div>

                <!-- Loading indicator -->
                <div
                    v-if="isGenerating && displayEvents.length === 0"
                    class="flex items-center justify-center py-12"
                >
                    <div class="text-center">
                        <svg
                            class="animate-spin h-12 w-12 text-primary-600 mx-auto mb-4"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                        >
                            <circle
                                class="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                stroke-width="4"
                            ></circle>
                            <path
                                class="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                        </svg>
                        <p class="text-gray-600">Initializing...</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Floating Chat Button -->
        <button
            @click="isChatOpen = true"
            class="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-full shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-200 flex items-center justify-center z-40 group"
            :class="{ 'animate-bounce': !isChatOpen && (isGenerating || completed) }"
        >
            <span class="text-2xl">💬</span>
            <span
                class="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"
                v-if="isGenerating || completed"
            ></span>
            <!-- Tooltip -->
            <span
                class="absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            >
                Chat with your docs
            </span>
        </button>

        <!-- Chat Window -->
        <ChatWindow
            :is-open="isChatOpen"
            :url="url"
            :is-generating="isGenerating"
            @close="isChatOpen = false"
        />
    </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
import ChatWindow from './ChatWindow.vue';

const props = defineProps({
    events: {
        type: Array,
        required: true,
    },
    isGenerating: {
        type: Boolean,
        required: true,
    },
    completed: {
        type: Boolean,
        required: true,
    },
    url: {
        type: String,
        required: true,
    },
});

defineEmits(['reset']);

// Timer
const elapsedTime = ref('00:00');
const startTime = ref(null);
let timerInterval = null;

const updateTimer = () => {
    if (!startTime.value) return;
    const elapsed = Math.floor((Date.now() - startTime.value) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    elapsedTime.value = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// Screenshot tracking
const currentScreenshot = ref(null);

// Collection JSON
const collectionJson = ref(null);
const copied = ref(false);

// Error handling
const hasError = ref(false);
const errorMessage = ref('');

// Chat state
const isChatOpen = ref(false);

const dismissError = () => {
    hasError.value = false;
    errorMessage.value = '';
};

// Watch for screenshot events - always use the latest one
watch(
    () => props.events,
    newEvents => {
        // Find the LAST screenshot event (most recent)
        const screenshotEvents = newEvents.filter(e => e.type === 'screenshot');
        if (screenshotEvents.length > 0) {
            const latestScreenshot = screenshotEvents[screenshotEvents.length - 1];
            if (latestScreenshot.data.screenshot) {
                currentScreenshot.value = `data:image/jpeg;base64,${latestScreenshot.data.screenshot}`;
            }
        }

        // Check for error events
        const errorEvents = newEvents.filter(e => e.type === 'error');
        if (errorEvents.length > 0) {
            const latestError = errorEvents[errorEvents.length - 1];
            hasError.value = true;
            errorMessage.value = latestError.data.message || 'An unknown error occurred';
        }

        // Check for collection events
        const collectionEvents = newEvents.filter(e => e.type === 'collection');
        if (collectionEvents.length > 0) {
            const latestCollection = collectionEvents[collectionEvents.length - 1];
            if (latestCollection.data.collection) {
                collectionJson.value = latestCollection.data.collection;
            }
        }
    },
    { deep: true }
);

// Start timer when generating starts
watch(
    () => props.isGenerating,
    isGen => {
        if (isGen && !startTime.value) {
            startTime.value = Date.now();
            timerInterval = setInterval(updateTimer, 1000);
        } else if (!isGen && timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    },
    { immediate: true }
);

onMounted(() => {
    if (props.isGenerating && !startTime.value) {
        startTime.value = Date.now();
        timerInterval = setInterval(updateTimer, 1000);
    }
});

onUnmounted(() => {
    if (timerInterval) {
        clearInterval(timerInterval);
    }
});

const formatJson = json => {
    return JSON.stringify(json, null, 2);
};

const copyCollection = async () => {
    try {
        await navigator.clipboard.writeText(JSON.stringify(collectionJson.value, null, 2));
        copied.value = true;
        setTimeout(() => {
            copied.value = false;
        }, 2000);
    } catch (error) {
        console.error('Failed to copy:', error);
    }
};

const displayEvents = computed(() => {
    return [...props.events].reverse();
});

const stats = computed(() => {
    return {
        reasoning: props.events.filter(e => e.type === 'reasoning').length,
        actions: props.events.filter(e => e.type === 'action').length,
    };
});

const getEventStyle = type => {
    switch (type) {
        case 'reasoning':
            return 'border-primary-400 bg-primary-50';
        case 'action':
            return 'border-green-400 bg-green-50';
        case 'started':
            return 'border-blue-400 bg-blue-50';
        case 'complete':
            return 'border-emerald-400 bg-emerald-50';
        case 'screenshot':
            return 'border-purple-400 bg-purple-50';
        case 'collection_generation_started':
            return 'border-indigo-400 bg-indigo-50';
        case 'collection':
            return 'border-teal-400 bg-teal-50';
        case 'error':
            return 'border-red-400 bg-red-50';
        default:
            return 'border-gray-400 bg-gray-50';
    }
};

const getEventTextColor = type => {
    switch (type) {
        case 'reasoning':
            return 'text-primary-700';
        case 'action':
            return 'text-green-700';
        case 'started':
            return 'text-blue-700';
        case 'complete':
            return 'text-emerald-700';
        case 'screenshot':
            return 'text-purple-700';
        case 'collection_generation_started':
            return 'text-indigo-700';
        case 'collection':
            return 'text-teal-700';
        case 'error':
            return 'text-red-700';
        default:
            return 'text-gray-700';
    }
};

const getEventIcon = type => {
    switch (type) {
        case 'reasoning':
            return '🧠';
        case 'action':
            return '⚡';
        case 'started':
            return '🚀';
        case 'complete':
            return '✅';
        case 'screenshot':
            return '📸';
        case 'collection_generation_started':
            return '🔧';
        case 'collection':
            return '📦';
        case 'error':
            return '❌';
        default:
            return '•';
    }
};

const getEventTitle = type => {
    switch (type) {
        case 'reasoning':
            return 'AI Reasoning';
        case 'action':
            return 'Browser Action';
        case 'started':
            return 'Started';
        case 'complete':
            return 'Complete';
        case 'screenshot':
            return 'Screenshot';
        case 'collection_generation_started':
            return 'Collection Generation';
        case 'collection':
            return 'Collection Generated';
        case 'error':
            return 'Error';
        default:
            return type;
    }
};

const formatTimestamp = timestamp => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
};

const formatActionDetails = action => {
    if (!action) return '';

    // Try to format as JSON if it's an object
    if (typeof action === 'object') {
        return JSON.stringify(action, null, 2);
    }

    return action;
};
</script>

<style scoped>
.slide-fade-enter-active {
    transition: all 0.3s ease;
}

.slide-fade-leave-active {
    transition: all 0.2s ease;
}

.slide-fade-enter-from {
    transform: translateY(-10px);
    opacity: 0;
}

.slide-fade-leave-to {
    transform: translateY(10px);
    opacity: 0;
}

/* Custom scrollbar */
::-webkit-scrollbar {
    width: 8px;
}

::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
}

::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
    background: #555;
}

/* Animate error banner entrance */
@keyframes pulse-once {
    0%,
    100% {
        opacity: 1;
    }
    50% {
        opacity: 0.8;
    }
}

.animate-pulse-once {
    animation: pulse-once 0.5s ease-in-out 2;
}
</style>
