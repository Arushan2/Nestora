<?php

declare(strict_types=1);

namespace Nestora\Core\Routing;

use Nestora\Core\Contracts\RouterInterface;
use Nestora\Core\Http\Request;
use Nestora\Core\Http\Response;
use RuntimeException;

class Router implements RouterInterface
{
    /** @var Route[] */
    private array $routes = [];

    public function addRoute(string $method, string $path, callable|array $handler): void
    {
        $this->routes[] = new Route($method, $path, $handler);
    }

    public function get(string $path, callable|array $handler): void
    {
        $this->addRoute('GET', $path, $handler);
    }

    public function post(string $path, callable|array $handler): void
    {
        $this->addRoute('POST', $path, $handler);
    }

    public function dispatch(Request $request): Response
    {
        $method = $request->getMethod();
        $path = $request->getPath();

        foreach ($this->routes as $route) {
            $params = [];
            if ($route->matches($method, $path, $params)) {
                $handler = $route->getHandler();

                if (is_array($handler) && count($handler) === 2 && is_string($handler[0])) {
                    $class = $handler[0];
                    $action = $handler[1];

                    if (!class_exists($class)) {
                        throw new RuntimeException("Controller class {$class} not found.");
                    }

                    $controller = new $class();
                    if (!method_exists($controller, $action)) {
                        throw new RuntimeException("Action {$action} not found on {$class}.");
                    }

                    $result = call_user_func_array([$controller, $action], array_merge([$request], array_values($params)));
                } else {
                    $result = call_user_func_array($handler, array_merge([$request], array_values($params)));
                }

                if ($result instanceof Response) {
                    return $result;
                }

                return Response::json(200, is_array($result) ? $result : []);
            }
        }

        return Response::error(404, 'Route not found.');
    }
}
