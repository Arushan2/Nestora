<?php

declare(strict_types=1);

namespace Nestora\Core\Contracts;

use Nestora\Core\Http\Request;
use Nestora\Core\Http\Response;

interface RouterInterface
{
    public function get(string $path, callable|array $handler): void;
    public function post(string $path, callable|array $handler): void;
    public function dispatch(Request $request): Response;
}
