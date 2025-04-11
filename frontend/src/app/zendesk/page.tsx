"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { useDropzone } from 'react-dropzone';
import parse from 'html-react-parser';
import { Flex, Box, Text } from '@radix-ui/themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { toast } from 'sonner';
import Link from 'next/link';
import { Upload, Video, Mic, Settings, HelpCircle, ExternalLink, X, Play, RefreshCw } from 'lucide-react';

interface VideoMetadata {
    name: string;
    type: string;
    size: number;
    lastModified: number;
}


export default function Index() {
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [originalVideoUrl, setOriginalVideoUrl] = useState<string | null>(null);
    const [processedVideoUrl, setProcessedVideoUrl] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [selectedModel, setSelectedModel] = useState<string>('gemini-2.0-flash-exp');
    const [globalContext, setGlobalContext] = useState<string>('');
    const [videoContext, setVideoContext] = useState<string>('');
    const [steps, setSteps] = useState<string>('');
    const [videoMode, setVideoMode] = useState<'help_center' | 'showcase'>('help_center');
    const [taskId, setTaskId] = useState<string | null>(null);
    const originalVideoRef = useRef<HTMLVideoElement | null>(null);
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [helpCenterUrl, setHelpCenterUrl] = useState<string>('');
    const [selectedVoice, setSelectedVoice] = useState<string>('en-US-LewisMultilingualNeural');
    const [isPushingToHelpCenter, setIsPushingToHelpCenter] = useState<boolean>(false);
    const [apiHost, setApiHost] = useState<string>('');
    const [originalVideoMetadata, setOriginalVideoMetadata] = useState<VideoMetadata | null>(null);

    useEffect(() => {
        const isProduction = process.env.NODE_ENV === 'production';
        const host = isProduction ? 'backend.getharkai.com' : window.location.hostname;
        const port = isProduction ? '' : ':8000';
        const protocol = isProduction ? 'https' : 'http';
        setApiHost(`${protocol}://${host}${port}`);
    }, []);

    useEffect(() => {
        const request = indexedDB.open('HarkaiVideoDB', 1);

        request.onerror = (event) => {
            const target = event.target as IDBOpenDBRequest;
            if (target) {
                console.error('IndexedDB error:', target.error);
            } else {
                console.error('IndexedDB error: event target is null');
            }
        };

        request.onupgradeneeded = (event) => {
            const target = event.target as IDBOpenDBRequest;
            const db = target.result;
            if (!db.objectStoreNames.contains('videos')) {
                db.createObjectStore('videos');
            }
        };

    }, []);

    useEffect(() => {
        const storedState = localStorage.getItem('videoProcessingState');
        if (storedState) {
            const { selectedModel, globalContext, videoContext, processedVideoUrl, steps, helpCenterUrl, selectedVoice, videoMode } = JSON.parse(storedState);
            setSelectedModel(selectedModel);
            setGlobalContext(globalContext);
            setVideoContext(videoContext);
            setProcessedVideoUrl(processedVideoUrl);
            setSteps(steps);
            if (helpCenterUrl) setHelpCenterUrl(helpCenterUrl);
            if (selectedVoice) setSelectedVoice(selectedVoice);
            if (videoMode) setVideoMode(videoMode);
        }

        const storedMetadata = localStorage.getItem('originalVideoMetadata');
        if (storedMetadata) {
            const metadata = JSON.parse(storedMetadata);
            setOriginalVideoMetadata(metadata);

            // Load video from IndexedDB
            const request = indexedDB.open('HarkaiVideoDB', 1);
            request.onsuccess = (event) => {
                const target = event.target as IDBOpenDBRequest;
                const db = target.result;
                const transaction = db.transaction(['videos'], 'readonly');
                const store = transaction.objectStore('videos');
                const getRequest = store.get('currentVideo');

                getRequest.onsuccess = () => {
                    if (getRequest.result) {
                        const file = new File([getRequest.result], metadata.name, { type: metadata.type });
                        setVideoFile(file);
                        const url = URL.createObjectURL(file);
                        setOriginalVideoUrl(url);
                    }
                };
            };
        }
    }, []);

    useEffect(() => {
        const stateToStore = {
            selectedModel,
            globalContext,
            videoContext,
            processedVideoUrl,
            steps,
            helpCenterUrl,
            selectedVoice,
            videoMode
        };
        localStorage.setItem('videoProcessingState', JSON.stringify(stateToStore));
    }, [selectedModel, globalContext, videoContext, processedVideoUrl, steps, helpCenterUrl, selectedVoice, videoMode]);

    useEffect(() => {
        if (originalVideoRef.current && originalVideoUrl) {
            originalVideoRef.current.src = originalVideoUrl;
            originalVideoRef.current.load();
        }
    }, [originalVideoUrl]);

    const handleModelChange = useCallback((value: string) => {
        setSelectedModel(value);
    }, []);

    const handleVoiceChange = useCallback((value: string) => {
        setSelectedVoice(value);
    }, []);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setVideoFile(file);
            setOriginalVideoUrl(url);
            setProcessedVideoUrl(null);

            const metadata: VideoMetadata = {
                name: file.name,
                type: file.type,
                size: file.size,
                lastModified: file.lastModified
            };
            setOriginalVideoMetadata(metadata);
            localStorage.setItem('originalVideoMetadata', JSON.stringify(metadata));

            const request = indexedDB.open('HarkaiVideoDB', 1);
            request.onsuccess = (event: any) => {
                const db = event.target.result;
                const transaction = db.transaction(['videos'], 'readwrite');
                const store = transaction.objectStore('videos');
                store.put(file, 'currentVideo');
            };
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'video/*': [] },
        multiple: false,
    });

    const handleGlobalContextChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
        setGlobalContext(event.target.value);
    }, []);

    const handleVideoContextChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
        setVideoContext(event.target.value);
    }, []);

    const processVideo = useCallback(async () => {
        if (!videoFile) return;

        setIsProcessing(true);
        const formData = new FormData();
        formData.append('video', videoFile);
        formData.append('model', selectedModel);
        formData.append('global_context', globalContext);
        formData.append('video_context', videoContext);
        formData.append('voice', selectedVoice);
        formData.append('video_mode', videoMode);

        try {
            console.log('Sending request to process video');
            const response = await fetch(`${apiHost}/processvideo/`, {
                method: 'POST',
                body: formData,
                
                //credentials: 'include',
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.task_id) {
                console.log('Setting task ID:', data.task_id);
                setTaskId(data.task_id);
                const wsProtocol = apiHost.startsWith('https') ? 'wss' : 'ws';
                const ws = new WebSocket(`${wsProtocol}://${apiHost.replace(/^https?:\/\//, '')}/ws/tasks/${data.task_id}/`);
                ws.onmessage = (event) => {
                    const message = JSON.parse(event.data);
                    console.log("WebSocket message received:", message);
                    if (message.message && message.message.success) {
                        setProcessedVideoUrl(message.message.video_url);
                        console.log("steps are " + message.message.text)
                        setSteps(message.message.text);
                        setIsProcessing(false);
                        ws.close();
                    }
                };
                ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    setIsProcessing(false);
                };

                ws.onclose = (event) => {
                    if (!event.wasClean) {
                        console.error('WebSocket connection closed unexpectedly');
                        setIsProcessing(false);
                    }
                };
            } else {
                console.error('No task ID in response');
            }
        } catch (error) {
            console.error('Error processing video:', error);
            setIsProcessing(false);
        }
    }, [videoFile, selectedModel, globalContext, videoContext, selectedVoice, apiHost]);

    const handleRemoveVideo = useCallback(() => {
        setVideoFile(null);
        setOriginalVideoUrl(null);
        setProcessedVideoUrl(null);
        setSteps("");
        localStorage.removeItem('originalVideoMetadata');

        const request = indexedDB.open('HarkaiVideoDB', 1);
        request.onsuccess = (event: Event) => {
            const target = event.target as IDBRequest;
            if (!target) return;
            const db = target.result as IDBDatabase;
            const transaction = db.transaction(['videos'], 'readwrite');
            const store = transaction.objectStore('videos');
            store.delete('currentVideo');
        };

        const storedState = JSON.parse(localStorage.getItem('videoProcessingState') || '{}');
        delete storedState.processedVideoUrl;
        delete storedState.steps;
        localStorage.setItem('videoProcessingState', JSON.stringify(storedState));
    }, []);


    const handleHelpCenterUrlChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        setHelpCenterUrl(event.target.value);
    }, []);

    const pushToHelpCenter = useCallback(async () => {
        if (!videoFile) {
            toast.error("Please upload a video first");
            return;
        }

        if (!helpCenterUrl) {
            toast.warning("Please enter a valid Help Center URL");
            return;
        }

        setIsPushingToHelpCenter(true);
        const formData = new FormData();

        formData.append('video_url', processedVideoUrl || '');
        formData.append('help_center_article_url', helpCenterUrl);
        formData.append('text', steps);

        try {
            const response = await fetch(`${apiHost}/pushtocenter/`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Push to help center response:', data);

            toast.success("Video and text successfully pushed to Help Center");
        } catch (error) {
            console.error('Error pushing to help center:', error);

            toast.error("Failed to push video to Help Center");
        } finally {
            setIsPushingToHelpCenter(false);
        }
    }, [videoFile, helpCenterUrl, steps, toast, apiHost, processedVideoUrl]);

    return (
        <Flex className="min-h-screen bg-gray-50 p-6 flex-col">
            <Box className="max-w-7xl mx-auto w-full">
                {/* Header */}
                <Flex className="justify-between items-center mb-8 bg-white p-4 rounded-lg shadow-sm">
                    <Text className="text-2xl font-bold">Harkai</Text>
                    <Flex className="items-center gap-4 ml-2">
                        <Flex className="items-center gap-2 bg-gray-100 p-2 rounded-lg">
                            <Button
                                variant={videoMode === 'help_center' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setVideoMode('help_center')}
                                className={videoMode === 'help_center' ? 'bg-white shadow-sm text-black hover:bg-white' : 'hover:bg-white'}
                            >
                                <HelpCircle className="mr-2" size={16} />
                                Help Center
                            </Button>
                            <Button
                                variant={videoMode === 'showcase' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setVideoMode('showcase')}
                                className={videoMode === 'showcase' ? 'bg-white shadow-sm text-black hover:bg-white' : 'hover:bg-white'}
                            >
                                <Video className="mr-2" size={16} />
                                Showcase
                            </Button>
                        </Flex>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsOpen(true)}
                        >
                            <Settings  size={16} />
                            Configure Context
                        </Button>
                    </Flex>
                </Flex>

                {/* Main Content */}
                <Flex className="gap-6 lg:flex-row flex-col">
                    {/* Left Panel */}
                    <Box className="flex-1 bg-white p-6 rounded-lg shadow-sm">
                        <Flex className="flex-col gap-6">
                            {/* Upload Area */}
                            <Box>
                                <Text className="font-semibold text-sm mb-2">Upload Video</Text>
                                {!originalVideoUrl ? (
                                    <Box
                                        {...getRootProps()}
                                        className={`border-2 border-dashed ${isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-200'} rounded-lg p-8 text-center transition-all cursor-pointer`}
                                    >
                                        <input {...getInputProps()} />
                                        <Flex className="flex-col items-center gap-3">
                                            <Box className="p-3 bg-blue-50 rounded-full">
                                                <Upload size={24} className="text-blue-500" />
                                            </Box>
                                            <Text>Drag & drop your video here</Text>
                                            <Text className="text-sm text-blue-500 font-medium">
                                                or click to browse
                                            </Text>
                                        </Flex>
                                    </Box>
                                ) : (
                                    <Box className="relative">
                                        <Box className="rounded-lg overflow-hidden border border-gray-200">
                                            <video
                                                ref={originalVideoRef}
                                                controls
                                                width="100%"
                                                className="block"
                                            >
                                                <source src={originalVideoUrl} type="video/mp4" />
                                            </video>
                                        </Box>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={handleRemoveVideo}
                                            className="absolute top-2 right-2"
                                        >
                                            <X size={14} className="mr-2" />
                                            Remove
                                        </Button>
                                    </Box>
                                )}
                            </Box>

                            {/* Settings */}
                            <Flex className="gap-4">
                                <Box className="flex-1">
                                    <Text className="font-medium mb-2">Model</Text>
                                    <Select value={selectedModel} onValueChange={handleModelChange}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a model" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="gemini-2.5-pro-exp-03-25">Gemini 2.5 Pro</SelectItem>
                                            <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
                                            <SelectItem value="gemini-2.0-flash-thinking-exp-01-21">Gemini 2 Flash Experimental Thinking</SelectItem>
                                              <SelectItem value="gemini-2.0-flash-exp">Gemini 2 Flash Experimental</SelectItem>
                                            <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                                            <SelectItem value="gemini-1.5-flash-002">Gemini 1.5 Flash 002</SelectItem>
                                            <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                                            <SelectItem value="gemini-1.5-pro-002">Gemini 1.5 Pro 002</SelectItem>
                                            <SelectItem value="gemini-1.5-pro-exp-0801">Gemini 1.5 Pro Experimental</SelectItem>
                                           
                                        </SelectContent>
                                    </Select>
                                </Box>
                                <Box className="flex-1">
                                    <Text className="font-medium mb-2">Voice</Text>
                                    <Select value={selectedVoice} onValueChange={handleVoiceChange}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a voice" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="en-US-AdamMultilingualNeural">Adam</SelectItem>
                                            <SelectItem value="en-US-DerekMultilingualNeural">Derek</SelectItem>
                                            <SelectItem value="en-US-DustinMultilingualNeural">Dustin</SelectItem>
                                            <SelectItem value="en-US-LewisMultilingualNeural">Lewis</SelectItem>
                                            <SelectItem value="en-US-LolaMultilingualNeural">Lola</SelectItem>
                                            <SelectItem value="en-US-PhoebeMultilingualNeural">Phoebe</SelectItem>
                                            <SelectItem value="en-US-SamuelMultilingualNeural">Samuel</SelectItem>
                                            <SelectItem value="en-US-SerenaMultilingualNeural">Serena</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </Box>
                            </Flex>

                            {/* Process Button */}
                            <Button
                                className="bg-black text-white hover:bg-black/80 focus:bg-black/80"
                                variant="default"
                                size="sm"
                                disabled={!videoFile || isProcessing}
                                onClick={processVideo}
                            >
                                {isProcessing ? (
                                    <>Processing...</>
                                ) : (
                                    <>
                                        <Play size={16} className="mr-2" />
                                        {processedVideoUrl ? 'Re-process Video' : 'Process Video'}
                                    </>
                                )}
                            </Button>

                            {/* Help Center Integration */}
                            <Box className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <Text className="font-medium mb-3">Help Center Integration</Text>
                                <Flex className="flex-col gap-3">
                                    <Input
                                        placeholder="Enter help center article URL"
                                        value={helpCenterUrl}
                                        onChange={handleHelpCenterUrlChange}
                                        className="bg-white"
                                    />
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={pushToHelpCenter}
                                        disabled={isPushingToHelpCenter}
                                        className="bg-green-600 hover:bg-green-700 text-white"
                                    >
                                        {isPushingToHelpCenter ? (
                                            <>
                                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                                Pushing...
                                            </>
                                        ) : (
                                            <>
                                                <HelpCircle size={16} className="mr-2" />
                                                Push to Help Center
                                            </>
                                        )}
                                    </Button>
                                </Flex>
                            </Box>
                        </Flex>
                    </Box>

                    {/* Right Panel */}
                    <Box className="flex-[1.2] bg-white p-6 rounded-lg shadow-sm">
                        {processedVideoUrl ? (
                            <Flex className="flex-col gap-6">
                                <Box>
                                    <Text className="mb-3 font-semibold text-sm">Processed Video</Text>
                                    <Box className="rounded-lg overflow-hidden border border-gray-200">
                                        <video controls width="100%" className="block">
                                            <source src={processedVideoUrl} type="video/mp4" />
                                        </video>
                                    </Box>
                                    <Link
                                        href={processedVideoUrl}
                                        className="text-blue-600 text-md mt-2 inline-flex items-center gap-1"
                                        target="_blank"
                                    >
                                        Download video <ExternalLink size={14} />
                                    </Link>
                                </Box>
                                <Box>
                                    <Text className="font-medium mb-3">Generated Content</Text>
                                    <Box className="bg-gray-50 rounded-lg border border-gray-200 prose prose-sm max-w-none p-4">
                                        {steps ? parse(steps) : <Text className="text-gray-500 p-4">No content generated yet</Text>}
                                    </Box>
                                </Box>
                            </Flex>
                        ) : (
                            <Flex className="flex-col items-center justify-center h-full py-12 text-gray-400">
                                <Video size={48} strokeWidth={1.5} />
                                <Text className="mt-4">Process a video to see results</Text>
                            </Flex>
                        )}

                        {isProcessing && (
                            <Flex className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="animate-spin text-blue-500 h-8 w-8" />
                                    <Text>Processing your video...</Text>
                                </div>
                            </Flex>
                        )}
                    </Box>
                </Flex>
            </Box>

            {/* Context Modal */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Configure Context</DialogTitle>
                        <DialogDescription>
                            Set up global and video-specific context for better processing
                        </DialogDescription>
                    </DialogHeader>
                    <Flex className="flex-col gap-6">
                        <Flex className="flex-col">
                            <Text className="font-medium mb-1">Global Context</Text>
                            <Text className="text-sm text-gray-500 mb-2">
                                Define company/product information and general objectives
                            </Text>
                            <Textarea
                                value={globalContext}
                                onChange={handleGlobalContextChange}
                                rows={4}
                            />
                        </Flex>
                        <Flex className="flex-col">
                            <Text className="font-medium mb-1">Video Context</Text>
                            <Text className="text-sm text-gray-500 mb-2">
                                Provide specific details about the current video content
                            </Text>
                            <Textarea
                                value={videoContext}
                                onChange={handleVideoContextChange}
                                rows={4}
                            />
                        </Flex>
                    </Flex>
                    <DialogFooter>
                        <Button onClick={() => setIsOpen(false)}>
                            Save Context
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Flex>

    );
}
