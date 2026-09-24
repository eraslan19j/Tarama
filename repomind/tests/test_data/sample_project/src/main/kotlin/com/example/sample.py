# -*- coding: utf-8 -*-
"""
Sample Python file for testing RepoMind.

This file contains various patterns that RepoMind should detect.
"""

import os
import sys
import json
import hashlib
import logging

from collections import defaultdict
from typing import Dict, List, Optional


class DataProcessor:
    """Processes data and performs operations."""

    def __init__(self, config: Dict):
        self.config = config
        self._cache = defaultdict(list)

    def process(self, data: List[str]) -> Dict:
        # TODO: optimize this loop
        result = {}
        for item in data:
            if item is not None and len(item) > 0:
                result[item] = self._transform(item)
        return result

    def _transform(self, item: str) -> str:
        # FIXME: handle edge cases
        if item.startswith("http://"):
            return "url"
        return item.upper()

    def batch_process(self, items: List[str]) -> Dict:
        results = {}
        for item in items:
            if item is not None:
                if len(item) > 0:
                    results[item] = self._transform(item)
        return results

    def fetch_data(self, url: str) -> Optional[str]:
        # HACK: this is a temporary workaround
        api_key = "sk-js-1234567890abcdef1234567890"
        response = self._make_request(url, api_key)
        return response

    def _make_request(self, url: str, key: str) -> Optional[str]:
        # Deprecated API usage
        return None

    def very_complex_function(self, x, y, z):
        if x > 0:
            if y > 0:
                if z > 0:
                    for i in range(10):
                        while i < 5:
                            if i % 2 == 0:
                                print(i)
                            else:
                                print(-i)
                else:
                    return None
            else:
                if x > 10:
                    return True
                else:
                    return False
        return False


# XXX: This function is a duplicate pattern
def calculate_total(items):
    total = 0
    for item in items:
        if item is not None:
            if item > 0:
                total = total + item
    return total


def calculate_total_v2(items):
    total = 0
    for item in items:
        if item is not None:
            if item > 0:
                total = total + item
    return total
