<?php

declare(strict_types=1);

namespace Nestora\Core\Http;

class Response
{
    private int $statusCode;
    private array $data;
    private array $headers;

    public function __construct(int $statusCode = 200, array $data = [], array $headers = [])
    {
        $this->statusCode = $statusCode;
        $this->data = $data;
        $this->headers = array_merge([
            'Content-Type' => 'application/json; charset=utf-8'
        ], $headers);
    }

    public static function json(int $statusCode, array $data = [], array $headers = []): self
    {
        return new self($statusCode, $data, $headers);
    }

    public static function error(int $statusCode, string $message, array $details = []): self
    {
        $payload = ['message' => $message];
        if (!empty($details)) {
            $payload['details'] = $details;
        }
        return new self($statusCode, $payload);
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }

    public function getData(): array
    {
        return $this->data;
    }

    public function send(): void
    {
        http_response_code($this->statusCode);
        foreach ($this->headers as $name => $value) {
            header(sprintf('%s: %s', $name, $value));
        }
        if (!empty($this->data) || $this->statusCode !== 204) {
            echo json_encode($this->data, JSON_UNESCAPED_SLASHES);
        }
        exit;
    }
}
