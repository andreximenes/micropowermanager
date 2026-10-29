<?php

namespace App\Exceptions;

/**
 * Thrown when an entity cannot be deleted because other records still depend on
 * it. Deleting it would leave those records pointing to a missing or tombstoned
 * parent, so the caller is expected to remove or reassign them first.
 */
class EntityHasChildrenException extends MpmException {}
