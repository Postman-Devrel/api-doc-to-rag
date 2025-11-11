<template>
    <Transition name="chat-fade">
        <div
            v-if="isOpen"
            class="fixed bottom-24 right-6 w-96 h-[600px] bg-white rounded-lg shadow-2xl flex flex-col z-50 border border-gray-200"
        >
            <!-- Header -->
            <div
                class="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-4 rounded-t-lg"
            >
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div
                            class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"
                        >
                            💬
                        </div>
                        <div>
                            <h3 class="font-semibold">Chat with Your Docs</h3>
                            <p class="text-xs text-primary-100">
                                {{ isGenerating ? 'Scraping in progress...' : 'Ask anything!' }}
                            </p>
                        </div>
                    </div>
                    <button
                        @click="$emit('close')"
                        class="text-white/80 hover:text-white transition-colors"
                    >
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Messages -->
            <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                <!-- Welcome message -->
                <div v-if="messages.length === 0" class="text-center text-gray-500 py-8">
                    <div class="text-4xl mb-3">🤖</div>
                    <p class="text-sm">Ask me anything about your API documentation!</p>
                    <p class="text-xs mt-2 text-gray-400">
                        I'll search through the scraped content to answer your questions.
                    </p>
                </div>

                <!-- Chat messages -->
                <TransitionGroup name="message-slide">
                    <div
                        v-for="message in messages"
                        :key="message.id"
                        :class="['flex', message.role === 'user' ? 'justify-end' : 'justify-start']"
                    >
                        <div
                            :class="[
                                'max-w-[80%] rounded-lg p-3 shadow-sm',
                                message.role === 'user'
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-white text-gray-800 border border-gray-200',
                            ]"
                        >
                            <div v-if="message.role === 'assistant'" class="flex items-start gap-2">
                                <span class="text-lg">🤖</span>
                                <div class="flex-1">
                                    <div class="text-sm whitespace-pre-wrap">
                                        {{ message.content }}
                                    </div>
                                    <div
                                        v-if="message.sources && message.sources.length > 0"
                                        class="mt-2 pt-2 border-t border-gray-200"
                                    >
                                        <div class="text-xs text-gray-500 mb-1">Sources:</div>
                                        <div class="space-y-1">
                                            <div
                                                v-for="(source, idx) in message.sources"
                                                :key="idx"
                                                class="text-xs bg-gray-50 p-2 rounded border border-gray-200"
                                            >
                                                <div class="font-mono text-gray-600 truncate">
                                                    {{ source.tags || 'General' }}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div v-else class="text-sm">{{ message.content }}</div>
                        </div>
                    </div>
                </TransitionGroup>

                <!-- Loading indicator -->
                <div v-if="isLoading" class="flex justify-start">
                    <div
                        class="bg-white text-gray-800 border border-gray-200 rounded-lg p-3 shadow-sm"
                    >
                        <div class="flex items-center gap-2">
                            <div class="flex space-x-1">
                                <div
                                    class="w-2 h-2 bg-primary-600 rounded-full animate-bounce"
                                ></div>
                                <div
                                    class="w-2 h-2 bg-primary-600 rounded-full animate-bounce"
                                    style="animation-delay: 0.1s"
                                ></div>
                                <div
                                    class="w-2 h-2 bg-primary-600 rounded-full animate-bounce"
                                    style="animation-delay: 0.2s"
                                ></div>
                            </div>
                            <span class="text-xs text-gray-500">Searching documentation...</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Input -->
            <div class="p-4 border-t border-gray-200 bg-white rounded-b-lg">
                <form @submit.prevent="sendMessage" class="flex gap-2">
                    <input
                        v-model="inputMessage"
                        type="text"
                        placeholder="Ask about your API..."
                        class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                        :disabled="isLoading || !url"
                    />
                    <button
                        type="submit"
                        :disabled="!inputMessage.trim() || isLoading || !url"
                        class="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                            />
                        </svg>
                    </button>
                </form>
                <p v-if="!url" class="text-xs text-gray-400 mt-2">
                    Enter a URL and start generation first
                </p>
            </div>
        </div>
    </Transition>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';

const props = defineProps({
    isOpen: {
        type: Boolean,
        required: true,
    },
    url: {
        type: String,
        default: '',
    },
    isGenerating: {
        type: Boolean,
        default: false,
    },
});

defineEmits(['close']);

const messages = ref([]);
const inputMessage = ref('');
const isLoading = ref(false);
const messagesContainer = ref(null);
const currentResponseId = ref(null); // Track response ID from Responses API

// Reset conversation when chat window is closed and reopened
watch(
    () => props.isOpen,
    (isOpen, wasOpen) => {
        // When closing, reset the conversation
        if (wasOpen && !isOpen) {
            currentResponseId.value = null;
            messages.value = [];
        }
    }
);

const scrollToBottom = () => {
    nextTick(() => {
        if (messagesContainer.value) {
            messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
        }
    });
};

watch(
    () => messages.value.length,
    () => {
        scrollToBottom();
    }
);

const sendMessage = async () => {
    if (!inputMessage.value.trim() || isLoading.value || !props.url) return;

    const userMessage = inputMessage.value.trim();
    inputMessage.value = '';

    // Add user message
    messages.value.push({
        id: Date.now(),
        role: 'user',
        content: userMessage,
    });

    isLoading.value = true;

    try {
        // Call chat API with response ID for conversation continuity (Responses API)
        const response = await fetch('/documentation/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: props.url,
                message: userMessage,
                responseId: currentResponseId.value, // Responses API uses this for stateful conversations
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Server error: ${response.status}`);
        }

        const data = await response.json();

        // Update response ID from Responses API for next message
        if (data.responseId) {
            currentResponseId.value = data.responseId;
        }

        // Add assistant message
        messages.value.push({
            id: Date.now() + 1,
            role: 'assistant',
            content: data.response,
            sources: data.sources || [],
        });
    } catch (error) {
        console.error('Chat error:', error);

        // Show more helpful error message
        const errorMessage = error.message || 'Unknown error occurred';
        messages.value.push({
            id: Date.now() + 1,
            role: 'assistant',
            content: `Sorry, I encountered an error: ${errorMessage}\n\nPlease check:\n- Is the documentation scraped?\n- Is the server running?\n- Check the browser console for details.`,
        });
    } finally {
        isLoading.value = false;
    }
};
</script>

<style scoped>
.chat-fade-enter-active,
.chat-fade-leave-active {
    transition: all 0.3s ease;
}

.chat-fade-enter-from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
}

.chat-fade-leave-to {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
}

.message-slide-enter-active {
    transition: all 0.3s ease;
}

.message-slide-enter-from {
    opacity: 0;
    transform: translateY(10px);
}

/* Custom scrollbar for messages */
::-webkit-scrollbar {
    width: 6px;
}

::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
}

::-webkit-scrollbar-thumb {
    background: #cbd5e0;
    border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
    background: #a0aec0;
}
</style>
