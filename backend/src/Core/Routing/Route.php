<?php

declare(strict_types=1);

namespace Nestora\Core\Routing;

class Route
{
    private string $method;
    private string $pathPattern;
    private mixed $handler;
    private string $regexPattern;
    private array $paramNames = [];

    public function __construct(string $method, string $pathPattern, mixed $handler)
    {
        $this->method = strtoupper($method);
        $this->pathPattern = $pathPattern;
        $this->handler = $handler;
        $this->compileRegex();
    }

    private function compileRegex(): void
    {
        // Convert route parameter tokens like /users/{id} or regex regex match
        $pattern = preg_replace_callback('#\{([a-zA-Z0-9_]+)\}#', function ($matches) {
            $this->paramNames[] = $matches[1];
            return '([^/]+)';
        }, $this->pathPattern);

        $this->regexPattern = '#^' . $pattern . '$#';
    }

    public function matches(string $method, string $path, array &$params = []): bool
    {
        if ($this->method !== strtoupper($method)) {
            return false;
        }

        if (preg_match($this->regexPattern, $path, $matches)) {
            array_shift($matches);
            $params = [];
            foreach ($matches as $index => $value) {
                $paramName = $this->paramNames[$index] ?? $index;
                $params[$paramName] = urldecode($value);
            }
            return true;
        }

        return false;
    }

    public function getHandler(): mixed
    {
        return $this->handler;
    }
}
