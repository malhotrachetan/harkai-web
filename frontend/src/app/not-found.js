'use client'

import { useState, useEffect } from 'react'
import { Box, Flex } from '@radix-ui/themes'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'


export default function NotFoundPage() {
   
    const router = useRouter()


   

    return (
        <Flex
            direction="column"
            align="center"
            justify="center"
            className="min-h-screen bg-white px-4 py-16"
        >
            <Box className="text-center">
                <h1 className="text-7xl font-semibold text-black">404</h1>
                <h2 className="mt-2 text-6xl font-semibold text-black">Page not found</h2>
                <p className="mt-4 text-lg font-medium text-black">
                    The page you are looking for doesn't exist or has been moved. <br />
                    Please go back to the homepage.
                </p>
                <Button
                    onClick={() => router.push('/')}
                    className="mt-8 bg-black text-white hover:opacity-80"
                >
                    Go to home
                </Button>
            </Box>
        </Flex>
    )
}
