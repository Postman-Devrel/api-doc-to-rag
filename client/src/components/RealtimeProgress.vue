<template>
    <div class="card">
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-semibold text-gray-900">
                {{ completed ? 'Generation Complete' : 'Generating Documentation' }}
            </h2>
            <button
                v-if="completed"
                @click="$emit('reset')"
                class="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
                Start New Generation
            </button>
        </div>

        <!-- Status Summary -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="bg-primary-50 rounded-lg p-4">
                <div class="text-sm font-medium text-primary-900 mb-1">Reasoning Steps</div>
                <div class="text-2xl font-bold text-primary-700">{{ stats.reasoning }}</div>
            </div>
            <div class="bg-green-50 rounded-lg p-4">
                <div class="text-sm font-medium text-green-900 mb-1">Actions Taken</div>
                <div class="text-2xl font-bold text-green-700">{{ stats.actions }}</div>
            </div>
            <div class="bg-purple-50 rounded-lg p-4">
                <div class="text-sm font-medium text-purple-900 mb-1">Resources Found</div>
                <div class="text-2xl font-bold text-purple-700">{{ stats.resources }}</div>
            </div>
        </div>

        <!-- Event Stream -->
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
                                    {{ getEventIcon(event.type) }} {{ getEventTitle(event.type) }}
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

                                <div v-else-if="event.type === 'started'" class="text-green-700">
                                    Starting browser automation for documentation extraction...
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

                                <div v-else-if="event.type === 'error'" class="text-red-700">
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
</template>

<script setup>
import { computed } from 'vue';

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
});

defineEmits(['reset']);

const displayEvents = computed(() => {
    return [...props.events].reverse();
});

const stats = computed(() => {
    return {
        reasoning: props.events.filter(e => e.type === 'reasoning').length,
        actions: props.events.filter(e => e.type === 'action').length,
        resources: props.events
            .filter(e => e.type === 'complete')
            .reduce((acc, e) => {
                return acc + (e.data?.resourceCount || 0);
            }, 0),
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
</style>
