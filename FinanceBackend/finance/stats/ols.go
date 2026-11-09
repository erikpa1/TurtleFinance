package stats

import (
	"errors"
	"math"
)

// OlsResult holds a linear regression fit y = Xβ + ε.
type OlsResult struct {
	Coef   []float64   `json:"coef"`
	StdErr []float64   `json:"stdErr"`
	TStat  []float64   `json:"tStat"`
	PValue []float64   `json:"pValue"`
	R2     float64     `json:"r2"`
	AdjR2  float64     `json:"adjR2"`
	N      int         `json:"n"`
	K      int         `json:"k"`
	SSR    float64     `json:"ssr"` // residual sum of squares
	Sigma2 float64     `json:"sigma2"`
	Cov    [][]float64 `json:"-"` // covariance of coefficients
}

// Ols fits y on X. X rows are observations; add an intercept column yourself
// (WithIntercept). Uses the normal equations with Gauss-Jordan inversion –
// fine for the small k (< 30) used here.
func Ols(y []float64, X [][]float64) (*OlsResult, error) {
	n := len(y)
	if n == 0 || len(X) != n {
		return nil, errors.New("ols: empty or mismatched data")
	}
	k := len(X[0])
	if n <= k {
		return nil, errors.New("ols: not enough observations")
	}

	xtx := make([][]float64, k)
	xty := make([]float64, k)
	for i := range xtx {
		xtx[i] = make([]float64, k)
	}
	for r := 0; r < n; r++ {
		row := X[r]
		for i := 0; i < k; i++ {
			xty[i] += row[i] * y[r]
			for j := i; j < k; j++ {
				xtx[i][j] += row[i] * row[j]
			}
		}
	}
	for i := 0; i < k; i++ {
		for j := 0; j < i; j++ {
			xtx[i][j] = xtx[j][i]
		}
	}

	inv, err := Invert(xtx)
	if err != nil {
		return nil, err
	}

	coef := make([]float64, k)
	for i := 0; i < k; i++ {
		for j := 0; j < k; j++ {
			coef[i] += inv[i][j] * xty[j]
		}
	}

	meanY := 0.0
	for _, v := range y {
		meanY += v
	}
	meanY /= float64(n)

	ssr, sst := 0.0, 0.0
	for r := 0; r < n; r++ {
		f := 0.0
		for i := 0; i < k; i++ {
			f += X[r][i] * coef[i]
		}
		e := y[r] - f
		ssr += e * e
		sst += (y[r] - meanY) * (y[r] - meanY)
	}

	dof := float64(n - k)
	sigma2 := ssr / dof

	res := &OlsResult{Coef: coef, N: n, K: k, SSR: ssr, Sigma2: sigma2,
		StdErr: make([]float64, k), TStat: make([]float64, k), PValue: make([]float64, k), Cov: make([][]float64, k)}

	for i := 0; i < k; i++ {
		res.Cov[i] = make([]float64, k)
		for j := 0; j < k; j++ {
			res.Cov[i][j] = inv[i][j] * sigma2
		}
		res.StdErr[i] = math.Sqrt(math.Max(res.Cov[i][i], 0))
		if res.StdErr[i] > 0 {
			res.TStat[i] = coef[i] / res.StdErr[i]
			res.PValue[i] = TTwoSidedP(res.TStat[i], dof)
		} else {
			res.PValue[i] = 1
		}
	}

	if sst > 0 {
		res.R2 = 1 - ssr/sst
		res.AdjR2 = 1 - (1-res.R2)*float64(n-1)/dof
	}
	return res, nil
}

// WithIntercept prepends a column of ones.
func WithIntercept(cols ...[]float64) [][]float64 {
	n := len(cols[0])
	X := make([][]float64, n)
	for r := 0; r < n; r++ {
		row := make([]float64, len(cols)+1)
		row[0] = 1
		for c, col := range cols {
			row[c+1] = col[r]
		}
		X[r] = row
	}
	return X
}

// Invert returns the inverse of a square matrix (Gauss-Jordan, partial pivoting).
func Invert(a [][]float64) ([][]float64, error) {
	k := len(a)
	m := make([][]float64, k)
	for i := range a {
		m[i] = make([]float64, 2*k)
		copy(m[i], a[i])
		m[i][k+i] = 1
	}

	for col := 0; col < k; col++ {
		pivot := col
		for r := col + 1; r < k; r++ {
			if math.Abs(m[r][col]) > math.Abs(m[pivot][col]) {
				pivot = r
			}
		}
		if math.Abs(m[pivot][col]) < 1e-14 {
			return nil, errors.New("singular matrix (collinear regressors or constant series)")
		}
		m[col], m[pivot] = m[pivot], m[col]

		p := m[col][col]
		for j := range m[col] {
			m[col][j] /= p
		}
		for r := 0; r < k; r++ {
			if r == col || m[r][col] == 0 {
				continue
			}
			f := m[r][col]
			for j := range m[r] {
				m[r][j] -= f * m[col][j]
			}
		}
	}

	inv := make([][]float64, k)
	for i := range inv {
		inv[i] = append([]float64{}, m[i][k:]...)
	}
	return inv, nil
}

// Corr is the Pearson correlation of equal-length slices.
func Corr(x, y []float64) float64 {
	n := len(x)
	if n < 3 || len(y) != n {
		return 0
	}
	mx, my := 0.0, 0.0
	for i := range x {
		mx += x[i]
		my += y[i]
	}
	mx /= float64(n)
	my /= float64(n)
	sxy, sxx, syy := 0.0, 0.0, 0.0
	for i := range x {
		dx, dy := x[i]-mx, y[i]-my
		sxy += dx * dy
		sxx += dx * dx
		syy += dy * dy
	}
	if sxx == 0 || syy == 0 {
		return 0
	}
	return sxy / math.Sqrt(sxx*syy)
}
