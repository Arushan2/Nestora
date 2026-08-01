<?php

declare(strict_types=1);

namespace Nestora\Core\Services;

use Nestora\Core\Contracts\StorageInterface;
use RuntimeException;

class CloudinaryStorageService implements StorageInterface
{
    private string $cloudName;
    private string $apiKey;
    private string $apiSecret;

    public function __construct()
    {
        $this->cloudName = (string) (getenv('CLOUDINARY_CLOUD_NAME') ?: '');
        $this->apiKey = (string) (getenv('CLOUDINARY_API_KEY') ?: '');
        $this->apiSecret = (string) (getenv('CLOUDINARY_API_SECRET') ?: '');
    }

    public function upload(string $filePath, string $originalName = ''): string
    {
        if ($this->cloudName === '' || $this->apiKey === '' || $this->apiSecret === '') {
            throw new RuntimeException('Cloudinary credentials not configured in environment.');
        }

        $timestamp = time();
        $paramsToSign = ['timestamp' => $timestamp];
        ksort($paramsToSign);

        $stringToSign = '';
        foreach ($paramsToSign as $key => $val) {
            $stringToSign .= "{$key}={$val}&";
        }
        $stringToSign = rtrim($stringToSign, '&') . $this->apiSecret;
        $signature = sha1($stringToSign);

        $url = "https://api.cloudinary.com/v1_1/{$this->cloudName}/auto/upload";

        $cfile = new \CURLFile($filePath, mime_content_type($filePath) ?: 'application/octet-stream', $originalName);

        $postData = [
            'file' => $cfile,
            'api_key' => $this->apiKey,
            'timestamp' => $timestamp,
            'signature' => $signature,
        ];

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $postData,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);

        $response = curl_exec($ch);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new RuntimeException('Cloudinary CURL error: ' . $error);
        }

        $result = json_decode((string) $response, true);
        if (!is_array($result) || !isset($result['secure_url'])) {
            $msg = $result['error']['message'] ?? 'Upload failed';
            throw new RuntimeException('Cloudinary upload error: ' . $msg);
        }

        return (string) $result['secure_url'];
    }
}
