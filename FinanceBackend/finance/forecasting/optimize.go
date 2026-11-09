package forecasting

import (
	"errors"
	"math"
	"sort"
)

// Parameter search ranges.
var paramBounds = map[string][2]float64{
	"alpha": {0.01, 0.99},
	"beta":  {0.001, 0.5},
	"gamma": {0.001, 0.99},
	"phi":   {0.8, 0.995},
}

func getParam(p Params, name string) float64 {
	switch name {
	case "alpha":
		return p.Alpha
	case "beta":
		return p.Beta
	case "gamma":
		return p.Gamma
	case "phi":
		return p.Phi
	}
	return 0
}

func setParam(p *Params, name string, v float64) {
	switch name {
	case "alpha":
		p.Alpha = v
	case "beta":
		p.Beta = v
	case "gamma":
		p.Gamma = v
	case "phi":
		p.Phi = v
	}
}

func DefaultParams() Params {
	return Params{Alpha: 0.3, Beta: 0.05, Gamma: 0.1, Phi: 0.98}
}

// optimizeOrUse either evaluates fn at the given params or minimises the
// one-step SSE over the named params: coarse grid search followed by a
// bounded Nelder–Mead refinement.
func optimizeOrUse(auto bool, p Params, names []string, fn func(Params) *Fit) (*Fit, error) {
	if !auto {
		defaults := DefaultParams()
		for _, name := range names {
			if getParam(p, name) <= 0 {
				setParam(&p, name, getParam(defaults, name))
			}
		}
		fit := fn(p)
		if fit.Count == 0 {
			return nil, errors.New("not enough data to fit")
		}
		return fit, nil
	}

	objective := func(x []float64) float64 {
		q := DefaultParams()
		for i, name := range names {
			b := paramBounds[name]
			setParam(&q, name, clamp(x[i], b[0], b[1]))
		}
		fit := fn(q)
		if fit.Count == 0 || math.IsNaN(fit.SSE) || math.IsInf(fit.SSE, 0) {
			return math.Inf(1)
		}
		return fit.SSE / float64(fit.Count)
	}

	// Coarse grid (≤ 4^d points).
	grid := map[string][]float64{
		"alpha": {0.05, 0.2, 0.5, 0.85},
		"beta":  {0.01, 0.05, 0.15, 0.3},
		"gamma": {0.05, 0.2, 0.5, 0.8},
		"phi":   {0.85, 0.92, 0.97, 0.99},
	}

	best := make([]float64, len(names))
	bestVal := math.Inf(1)
	cur := make([]float64, len(names))

	var walk func(d int)
	walk = func(d int) {
		if d == len(names) {
			v := objective(cur)
			if v < bestVal {
				bestVal = v
				copy(best, cur)
			}
			return
		}
		for _, v := range grid[names[d]] {
			cur[d] = v
			walk(d + 1)
		}
	}
	walk(0)

	if math.IsInf(bestVal, 1) {
		return nil, errors.New("optimisation failed (no valid fit)")
	}

	x := nelderMead(objective, best, names, 120)

	q := DefaultParams()
	for i, name := range names {
		b := paramBounds[name]
		setParam(&q, name, clamp(x[i], b[0], b[1]))
	}

	fit := fn(q)
	if fit.Count == 0 {
		return nil, errors.New("not enough data to fit")
	}
	return fit, nil
}

// nelderMead is a small bounded simplex minimiser.
func nelderMead(f func([]float64) float64, x0 []float64, names []string, maxIter int) []float64 {
	d := len(x0)
	type vertex struct {
		x []float64
		v float64
	}

	clampX := func(x []float64) []float64 {
		for i, name := range names {
			b := paramBounds[name]
			x[i] = clamp(x[i], b[0], b[1])
		}
		return x
	}

	simplex := make([]vertex, d+1)
	simplex[0] = vertex{append([]float64{}, x0...), f(x0)}
	for i := 0; i < d; i++ {
		x := append([]float64{}, x0...)
		b := paramBounds[names[i]]
		x[i] += (b[1] - b[0]) * 0.1
		x = clampX(x)
		simplex[i+1] = vertex{x, f(x)}
	}

	for iter := 0; iter < maxIter; iter++ {
		sort.Slice(simplex, func(i, j int) bool { return simplex[i].v < simplex[j].v })

		if math.Abs(simplex[d].v-simplex[0].v) < 1e-10*(math.Abs(simplex[0].v)+1e-12) {
			break
		}

		centroid := make([]float64, d)
		for i := 0; i < d; i++ {
			for j := 0; j < d; j++ {
				centroid[j] += simplex[i].x[j] / float64(d)
			}
		}

		at := func(t float64) []float64 {
			x := make([]float64, d)
			for j := range x {
				x[j] = centroid[j] + t*(simplex[d].x[j]-centroid[j])
			}
			return clampX(x)
		}

		xr := at(-1)
		vr := f(xr)

		switch {
		case vr < simplex[0].v:
			xe := at(-2)
			if ve := f(xe); ve < vr {
				simplex[d] = vertex{xe, ve}
			} else {
				simplex[d] = vertex{xr, vr}
			}
		case vr < simplex[d-1].v:
			simplex[d] = vertex{xr, vr}
		default:
			xc := at(0.5)
			if vc := f(xc); vc < simplex[d].v {
				simplex[d] = vertex{xc, vc}
			} else {
				for i := 1; i <= d; i++ {
					for j := 0; j < d; j++ {
						simplex[i].x[j] = simplex[0].x[j] + 0.5*(simplex[i].x[j]-simplex[0].x[j])
					}
					simplex[i].v = f(simplex[i].x)
				}
			}
		}
	}

	sort.Slice(simplex, func(i, j int) bool { return simplex[i].v < simplex[j].v })
	return simplex[0].x
}
