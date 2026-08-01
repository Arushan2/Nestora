<?php

declare(strict_types=1);

namespace Nestora\Core\Http;

class Request
{
    private string $method;
    private string $uri;
    private string $path;
    private array $query;
    private array $body;
    private array $files;
    private array $server;

    public function __construct(
        ?string $method = null,
        ?string $uri = null,
        ?array $query = null,
        ?array $body = null,
        ?array $files = null,
        ?array $server = null
    ) {
        $this->server = $server ?? $_SERVER;
        $this->method = strtoupper($method ?? ($this->server['REQUEST_METHOD'] ?? 'GET'));
        $this->uri = $uri ?? ($this->server['REQUEST_URI'] ?? '/');
        $this->path = parse_url($this->uri, PHP_URL_PATH) ?? '/';
        $this->query = $query ?? $_GET;
        $this->files = $files ?? $_FILES;
        $this->body = $body ?? $this->parseInputBody();
    }

    private function parseInputBody(): array
    {
        $input = file_get_contents('php://input');
        if ($input !== false && trim($input) !== '') {
            $json = json_decode($input, true);
            if (is_array($json)) {
                return array_merge($_POST, $json);
            }
        }
        return $_POST;
    }

    public function getMethod(): string
    {
        return $this->method;
    }

    public function getUri(): string
    {
        return $this->uri;
    }

    public function getPath(): string
    {
        return $this->path;
    }

    public function getQuery(?string $key = null, mixed $default = null): mixed
    {
        if ($key === null) {
            return $this->query;
        }
        return $this->query[$key] ?? $default;
    }

    public function getBody(?string $key = null, mixed $default = null): mixed
    {
        if ($key === null) {
            return $this->body;
        }
        return $this->body[$key] ?? $default;
    }

    public function getFile(string $key): ?array
    {
        return $this->files[$key] ?? null;
    }

    public function getHeader(string $key, ?string $default = null): ?string
    {
        $normalizedKey = 'HTTP_' . strtoupper(str_replace('-', '_', $key));
        return $this->server[$normalizedKey] ?? $this->server[strtoupper($key)] ?? $default;
    }

    public function getSession(?string $key = null, mixed $default = null): mixed
    {
        if ($key === null) {
            return $_SESSION ?? [];
        }
        return $_SESSION[$key] ?? $default;
    }

    public function setSession(string $key, mixed $value): void
    {
        $_SESSION[$key] = $value;
    }

    public function unsetSession(string $key): void
    {
        unset($_SESSION[$key]);
    }
}
