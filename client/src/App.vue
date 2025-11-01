<template>
    <div class="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        <div class="max-w-5xl mx-auto">
            <!-- Header -->
            <div class="text-center mb-12">
                <h1 class="text-4xl font-bold text-gray-900 mb-3">API Documentation Generator</h1>
                <p class="text-lg text-gray-600">
                    Generate comprehensive API documentation from any website in real-time
                </p>
            </div>

            <!-- Input Section -->
            <div class="card mb-8">
                <form @submit.prevent="startGeneration" class="space-y-4">
                    <div>
                        <label for="url" class="block text-sm font-medium text-gray-700 mb-2">
                            Website URL
                        </label>
                        <input
                            id="url"
                            v-model="url"
                            type="url"
                            placeholder="https://api.example.com/docs"
                            class="input"
                            required
                            :disabled="isGenerating"
                        />
                    </div>

                    <button
                        type="submit"
                        class="btn btn-primary w-full"
                        :disabled="isGenerating || !url"
                    >
                        <span v-if="!isGenerating">Generate Documentation</span>
                        <span v-else class="flex items-center justify-center">
                            <svg
                                class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                            Generating...
                        </span>
                    </button>
                </form>

                <!-- Error Display -->
                <div v-if="error" class="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p class="text-sm text-red-800">{{ error }}</p>
                </div>
            </div>

            <!-- Progress Section -->
            <RealtimeProgress
                v-if="isGenerating || completed"
                :events="events"
                :is-generating="isGenerating"
                :completed="completed"
                @reset="resetGeneration"
            />
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';
import RealtimeProgress from './components/RealtimeProgress.vue';

const url = ref('');
const isGenerating = ref(false);
const completed = ref(false);
const error = ref(null);
const events = ref([]);
let eventSource = null;

const startGeneration = async () => {
    if (!url.value) return;

    // Reset state
    isGenerating.value = true;
    completed.value = false;
    error.value = null;
    events.value = [];

    try {
        // Connect to SSE endpoint
        eventSource = new EventSource(
            `/knowledge-base/stream?url=${encodeURIComponent(url.value)}`
        );

        eventSource.onmessage = event => {
            try {
                const data = JSON.parse(event.data);
                events.value.push({
                    ...data,
                    id: Date.now() + Math.random(),
                });

                // Check for completion or error
                if (data.type === 'complete') {
                    isGenerating.value = false;
                    completed.value = true;
                    eventSource.close();
                } else if (data.type === 'error') {
                    isGenerating.value = false;
                    error.value = data.data.message;
                    eventSource.close();
                }
            } catch (err) {
                console.error('Failed to parse SSE message:', err);
            }
        };

        eventSource.onerror = err => {
            console.error('SSE error:', err);
            error.value = 'Connection to server lost. Please try again.';
            isGenerating.value = false;
            eventSource.close();
        };
    } catch (err) {
        error.value = err.message;
        isGenerating.value = false;
    }
};

const resetGeneration = () => {
    if (eventSource) {
        eventSource.close();
    }
    url.value = '';
    isGenerating.value = false;
    completed.value = false;
    error.value = null;
    events.value = [];
};
</script>
